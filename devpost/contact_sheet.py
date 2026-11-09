import sys, cv2, numpy as np
video, out, start, end, step = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
cap = cv2.VideoCapture(video)
tiles = []
t = start
while t <= end:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, f = cap.read()
    if ok:
        f = f[270:810, 0:1152]  # Lens panel area in the 1920x1080 OBS frame
        f = cv2.resize(f, (384, 180))
        cv2.putText(f, f"{t:.0f}s", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        tiles.append(f)
    t += step
cols = 4
while len(tiles) % cols:
    tiles.append(np.zeros_like(tiles[0]))
rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
cv2.imwrite(out, np.vstack(rows))
print("tiles:", len(tiles))
