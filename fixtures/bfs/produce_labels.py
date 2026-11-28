"""Independent reference BFS for the repository-owned graph fixture."""

import json
import sys
from collections import deque


def produce(graph):
    adjacency = [[] for _ in range(graph["vertex_count"])]
    for tail, head in graph["edges"]:
        adjacency[tail].append(head)

    source = graph["source"]
    labels = [None] * len(adjacency)
    labels[source] = 0
    queue = deque([source])
    while queue:
        tail = queue.popleft()
        for head in adjacency[tail]:
            if labels[head] is None:
                labels[head] = labels[tail] + 1
                queue.append(head)

    return {"schema_version": "truth-harness.bfs-certificate.v0", **graph, "labels": labels}


if __name__ == "__main__":
    certificate = produce(json.load(sys.stdin))
    sys.stdout.buffer.write(json.dumps(certificate, separators=(",", ":")).encode("utf-8") + b"\n")
