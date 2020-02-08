import sys

while True:
    out = []
    for idx, line in enumerate(sys.stdin):
        if idx % 4 == 0:
            out.append(line[:-4])
        if idx == 15:
            break
    print(f'[{", ".join(out)}, ],')
