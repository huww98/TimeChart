# start, prepare data, data ready, finish, FMP
FP_DATA = {
    'Chart.JS': [
        [32.4, 45.1, 297.6, 1042.4, 1054.8],
        [33.6, 43.4, 285.1, 1041.6, 1064.5],
        [30.9, 40.9, 292.7, 1036.2, 1056.8],
    ],
    'TimeChart': [
        [29.9, 57.2, 255.2, 288.3, 853.2],
        [36.2, 43.9, 236.9, 271.5, 837.4],
        [34.9, 42.7, 252.4, 285.7, 871.9],
    ],
    'μPlot': [
        [29.6, 31.4, 189.8, 285.6, 335.3],
        [30.6, 32.8, 197.3, 305.5, 350.0],
        [37.9, 40.7, 209.7, 311.7, 351.7],
    ],
}

import matplotlib.pyplot as plt
import numpy as np

y = []
prepare_data = []
data_ready = []
finish = []
fmp = []
for lib in FP_DATA:
    data = np.array(FP_DATA[lib])
    data = data[:, 1:] - data[:, 0:1]
    data = data.mean(axis=0)
    y.append(lib)
    prepare_data.append(data[0])
    data_ready.append(data[1])
    finish.append(data[2])
    fmp.append(data[3])

plt.title('First Paint Time')
plt.xlabel('ms')
plt.barh(y, fmp, label='paint')
plt.barh(y, finish, label='scripting')
plt.barh(y, data_ready, label='prepare data')
plt.barh(y, prepare_data, label='load script')
plt.legend()
plt.tight_layout()
plt.savefig('docs/first_paint.png')
