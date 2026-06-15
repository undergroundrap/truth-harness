import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  type ScryptOptions
} from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

const DEFAULT_VAULT_KEY_ENV = "TRUTH_HARNESS_VAULT_KEY";
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
) => Promise<Buffer>;

export interface VaultEncryptionMetadata {
  algorithm: "aes-256-gcm";
  kdf: "scrypt";
  kdfParams: {
    saltBase64: string;
    keyLength: number;
    cost: number;
    blockSize: number;
    parallelization: number;
  };
  ivBase64: string;
  authTagBase64: string;
  keyPolicy: "environment-only";
  keyRef: string;
}

export interface VaultEnvelope {
  schemaVersion: "truth-harness.vault.v0";
  vaultId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  payloadContentType: "application/json";
  payloadBytes: number;
  ciphertextBytes: number;
  ciphertextSha256: string;
  ciphertextBase64: string;
  encryption: VaultEncryptionMetadata;
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface VaultEnvelopeSummary {
  schemaVersion: "truth-harness.vault.v0";
  vaultId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  payloadContentType: "application/json";
  payloadBytes: number;
  ciphertextBytes: number;
  ciphertextSha256: string;
  encryption: Pick<VaultEncryptionMetadata, "algorithm" | "kdf" | "keyPolicy" | "keyRef">;
  privacy: PrivacyMetadata;
  warnings: string[];
}

interface VaultPayload {
  schemaVersion: "truth-harness.vault-payload.v0";
  sealedAt: string;
  sourceRef: string;
  originalFileName: string;
  plaintextSha256: string;
  plaintextBytes: number;
  bytesBase64: string;
}

export interface VaultPayloadSummary {
  schemaVersion: "truth-harness.vault-payload.v0";
  sealedAt: string;
  sourceRef: string;
  originalFileName: string;
  plaintextSha256: string;
  plaintextBytes: number;
}

export interface SealVaultFileInput {
  rootPath: string;
  sourcePath: string;
  label?: string;
  keyEnv?: string;
  now?: string;
}

export interface VaultSealResult {
  entry: VaultEnvelope;
  path: string;
}

export interface OpenVaultEntryInput {
  rootPath: string;
  vaultRef: string;
  keyEnv?: string;
}

export interface VaultOpenResult {
  entry: VaultEnvelopeSummary;
  payload: VaultPayloadSummary;
  bytes: Uint8Array;
}

export interface VaultVerifyResult {
  verified: true;
  entry: VaultEnvelopeSummary;
  payload: VaultPayloadSummary;
}

export async function sealVaultFile(input: SealVaultFileInput): Promise<VaultSealResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const sourcePath = resolveWorkspaceLocalPath(status.root, input.sourcePath);
  const bytes = await readFile(sourcePath);
  const label = normalizeOptionalText(input.label) ?? basename(sourcePath);
  const payload: VaultPayload = {
    schemaVersion: "truth-harness.vault-payload.v0",
    sealedAt: createdAt,
    sourceRef: toPortablePath(relative(status.root, sourcePath)),
    originalFileName: basename(sourcePath),
    plaintextSha256: sha256(bytes),
    plaintextBytes: bytes.byteLength,
    bytesBase64: bytes.toString("base64")
  };
  const payloadJson = `${JSON.stringify(payload)}\n`;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const keyEnv = normalizeKeyEnv(input.keyEnv);
  const key = await deriveKey(requireVaultPassphrase(keyEnv), salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payloadJson, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const entryWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    updatedAt: createdAt,
    label,
    payloadContentType: "application/json" as const,
    payloadBytes: Buffer.byteLength(payloadJson),
    ciphertextBytes: ciphertext.byteLength,
    ciphertextSha256: sha256(ciphertext),
    ciphertextBase64: ciphertext.toString("base64"),
    encryption: {
      algorithm: "aes-256-gcm" as const,
      kdf: "scrypt" as const,
      kdfParams: {
        saltBase64: salt.toString("base64"),
        keyLength: SCRYPT_KEY_LENGTH,
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK_SIZE,
        parallelization: SCRYPT_PARALLELIZATION
      },
      ivBase64: iv.toString("base64"),
      authTagBase64: authTag.toString("base64"),
      keyPolicy: "environment-only" as const,
      keyRef: `env:${keyEnv}`
    }
  };
  const vaultId = `vault_${stableHash(entryWithoutId).slice(0, 16)}`;
  const entry: VaultEnvelope = {
    schemaVersion: "truth-harness.vault.v0",
    vaultId,
    ...entryWithoutId,
    privacy: manifest.privacy,
    warnings: vaultWarnings()
  };

  const vaultDir = resolve(status.root, manifest.directories.vault);
  await mkdir(vaultDir, { recursive: true });
  const path = join(vaultDir, `${entry.createdAt.slice(0, 10)}-${entry.vaultId}.json`);
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, path),
    kind: "vault",
    now: entry.createdAt,
    staleReason: "vault envelope written"
  });

  return { entry, path };
}

export async function listVaultEntries(rootPath: string): Promise<VaultEnvelopeSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const vaultDir = resolve(status.root, status.manifest.directories.vault);

  let files: string[];
  try {
    files = await readdir(vaultDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const entries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(vaultDir, file), "utf8")) as VaultEnvelope)
  );

  return entries
    .filter((entry) => entry.schemaVersion === "truth-harness.vault.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(summarizeEnvelope);
}

export async function verifyVaultEntry(input: OpenVaultEntryInput): Promise<VaultVerifyResult> {
  const opened = await openVaultEntry(input);
  return {
    verified: true,
    entry: opened.entry,
    payload: opened.payload
  };
}

export async function openVaultEntry(input: OpenVaultEntryInput): Promise<VaultOpenResult> {
  const { entry } = await readVaultEnvelopeRef(input.rootPath, input.vaultRef);
  validateVaultEnvelope(entry);
  const ciphertext = Buffer.from(entry.ciphertextBase64, "base64");

  if (sha256(ciphertext) !== entry.ciphertextSha256) {
    throw new Error("Vault envelope ciphertext digest mismatch.");
  }

  try {
    const keyEnv = normalizeKeyEnv(input.keyEnv ?? envNameFromKeyRef(entry.encryption.keyRef));
    const key = await deriveKey(requireVaultPassphrase(keyEnv), Buffer.from(entry.encryption.kdfParams.saltBase64, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(entry.encryption.ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(entry.encryption.authTagBase64, "base64"));
    const payloadJson = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const payload = JSON.parse(payloadJson) as VaultPayload;
    validateVaultPayload(payload);
    const bytes = Buffer.from(payload.bytesBase64, "base64");

    if (bytes.byteLength !== payload.plaintextBytes || sha256(bytes) !== payload.plaintextSha256) {
      throw new Error("Vault payload digest mismatch.");
    }

    return {
      entry: summarizeEnvelope(entry),
      payload: summarizePayload(payload),
      bytes
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("digest mismatch")) {
      throw error;
    }

    throw new Error("Vault decrypt failed. Check the vault key and encrypted envelope integrity.");
  }
}

function summarizeEnvelope(entry: VaultEnvelope): VaultEnvelopeSummary {
  return {
    schemaVersion: entry.schemaVersion,
    vaultId: entry.vaultId,
    projectId: entry.projectId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    label: entry.label,
    payloadContentType: entry.payloadContentType,
    payloadBytes: entry.payloadBytes,
    ciphertextBytes: entry.ciphertextBytes,
    ciphertextSha256: entry.ciphertextSha256,
    encryption: {
      algorithm: entry.encryption.algorithm,
      kdf: entry.encryption.kdf,
      keyPolicy: entry.encryption.keyPolicy,
      keyRef: entry.encryption.keyRef
    },
    privacy: entry.privacy,
    warnings: entry.warnings
  };
}

async function readVaultEnvelopeRef(
  rootPath: string,
  vaultRef: string
): Promise<{
  entry: VaultEnvelope;
  path: string;
}> {
  const status = await requireLocalWorkspace(rootPath);
  const ref = requireText(vaultRef, "Vault ref is required.");

  if (isVaultId(ref)) {
    const vaultDir = resolve(status.root, status.manifest.directories.vault);
    const files = await readdir(vaultDir);
    for (const file of files.filter((file) => file.endsWith(".json"))) {
      const path = join(vaultDir, file);
      const entry = JSON.parse(await readFile(path, "utf8")) as VaultEnvelope;
      if (entry.schemaVersion === "truth-harness.vault.v0" && entry.vaultId === ref) {
        return { entry, path };
      }
    }

    throw new Error(`Vault entry not found: ${ref}`);
  }

  const path = resolveWorkspaceLocalPath(status.root, ref);
  return {
    entry: JSON.parse(await readFile(path, "utf8")) as VaultEnvelope,
    path
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before using the vault.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(passphrase, salt, SCRYPT_KEY_LENGTH, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAXMEM
  });
}

function requireVaultPassphrase(keyEnv: string): string {
  const passphrase = process.env[keyEnv];
  if (!passphrase) {
    throw new Error(`Missing vault key. Set ${keyEnv} before sealing, verifying, or opening private vault entries.`);
  }

  if (passphrase.length < 12) {
    throw new Error(`Vault key ${keyEnv} must be at least 12 characters.`);
  }

  return passphrase;
}

function validateVaultEnvelope(entry: VaultEnvelope): void {
  if (entry.schemaVersion !== "truth-harness.vault.v0") {
    throw new Error(`Unsupported vault schema: ${JSON.stringify(entry.schemaVersion)}`);
  }

  if (entry.encryption.algorithm !== "aes-256-gcm" || entry.encryption.kdf !== "scrypt") {
    throw new Error("Unsupported vault encryption metadata.");
  }

  if (entry.encryption.kdfParams.keyLength !== SCRYPT_KEY_LENGTH) {
    throw new Error("Unsupported vault key length.");
  }
}

function validateVaultPayload(payload: VaultPayload): void {
  if (payload.schemaVersion !== "truth-harness.vault-payload.v0") {
    throw new Error(`Unsupported vault payload schema: ${JSON.stringify(payload.schemaVersion)}`);
  }
}

function summarizePayload(payload: VaultPayload): VaultPayloadSummary {
  return {
    schemaVersion: payload.schemaVersion,
    sealedAt: payload.sealedAt,
    sourceRef: payload.sourceRef,
    originalFileName: payload.originalFileName,
    plaintextSha256: payload.plaintextSha256,
    plaintextBytes: payload.plaintextBytes
  };
}

function resolveWorkspaceLocalPath(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function normalizeKeyEnv(value: string | undefined): string {
  const normalized = normalizeOptionalText(value) ?? DEFAULT_VAULT_KEY_ENV;
  if (!/^[A-Z_][A-Z0-9_]*$/.test(normalized)) {
    throw new Error(`Vault key env var must be an uppercase environment variable name: ${JSON.stringify(value)}`);
  }

  return normalized;
}

function envNameFromKeyRef(keyRef: string): string | undefined {
  return keyRef.startsWith("env:") ? keyRef.slice("env:".length) : undefined;
}

function isVaultId(value: string): boolean {
  return /^vault_[a-f0-9]{16}$/.test(value);
}

function vaultWarnings(): string[] {
  return [
    "Vault entries encrypt local payload bytes at rest; unlocked plaintext and exported files are the user's responsibility.",
    "Keep vault keys in the environment or an operating-system secret manager. Do not store passphrases in manifests, receipts, prompts, or source control.",
    "Encrypted vault records preserve private data provenance; they do not prove scientific truth, medical validity, regulatory compliance, or patentability."
  ];
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
