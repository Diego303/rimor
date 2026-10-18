"""Genera los valores de referencia de @rimor/estadistica con NumPy y SciPy (IN-011).

Uso (con un entorno que tenga numpy y scipy):
    python generar.py > casos.json

Cada caso trae dos series y lo que deben dar: descriptiva de cada una (mediana, media, desviación típica
muestral, coeficiente de variación, mínimo, máximo, percentiles 5, 25, 75 y 95 con interpolación lineal) y la
prueba de Mann-Whitney U bilateral con aproximación normal, corrección por empates y de continuidad.
"""
import json
import math

import numpy as np
from scipy import stats

rng = np.random.default_rng(20261018)


def describir(v):
    a = np.asarray(v, dtype=float)
    sd = float(np.std(a, ddof=1)) if len(a) > 1 else None
    media = float(np.mean(a))
    return {
        "n": len(a),
        "mediana": float(np.median(a)),
        "media": media,
        "desviacion": sd,
        "cv": (sd / media) if sd is not None else None,
        "minimo": float(np.min(a)),
        "maximo": float(np.max(a)),
        "p5": float(np.percentile(a, 5)),
        "q1": float(np.percentile(a, 25)),
        "q3": float(np.percentile(a, 75)),
        "p95": float(np.percentile(a, 95)),
    }


def mann_whitney(x, y):
    r = stats.mannwhitneyu(x, y, alternative="two-sided", method="asymptotic", use_continuity=True)
    return {"u": float(r.statistic), "p": float(r.pvalue)}


casos = []

# El ejemplo del plan (reqwest frente a ureq, pantallas de referencia).
reqwest = [38.41, 39.02, 37.88, 38.76, 40.12, 38.15, 37.94, 38.60, 39.35, 38.02, 38.88, 41.70, 38.27, 38.49, 37.71, 39.10, 38.33, 38.95, 38.11, 38.58]
ureq = [36.92, 37.40, 35.88, 36.51, 38.95, 36.20, 37.11, 36.74, 35.97, 37.66, 36.38, 40.21, 36.85, 36.03, 37.29, 36.60, 35.79, 37.02, 36.47, 36.99]
casos.append(("plan: reqwest frente a ureq", reqwest, ureq))

tamanos = [3, 5, 7, 9, 10, 12, 15, 20, 25, 30, 40, 60]
for i, n in enumerate(tamanos):
    m = tamanos[(i + 3) % len(tamanos)]
    a = rng.normal(40, 1.5, n)
    b = rng.normal(40 * (1 - 0.02 * (i % 4)), 1.5, m)
    casos.append((f"normales n={n} m={m}", a.round(3).tolist(), b.round(3).tolist()))

for i, n in enumerate([6, 10, 20, 30, 50]):
    # Con muchos empates: valores redondeados a enteros.
    a = rng.normal(20, 2, n).round(0)
    b = rng.normal(21, 2, n + i).round(0)
    casos.append((f"empates n={n}", a.tolist(), b.tolist()))

for i, n in enumerate([8, 15, 24, 35]):
    # Colas largas (latencias con atípicos).
    a = rng.lognormal(3.6, 0.3, n)
    b = rng.lognormal(3.5, 0.3, n)
    casos.append((f"lognormales n={n}", a.round(4).tolist(), b.round(4).tolist()))

casos.append(("idénticas", [5.0] * 8, [5.0] * 8))
casos.append(("sin solape", [1.0, 2.0, 3.0, 4.0, 5.0], [6.0, 7.0, 8.0, 9.0, 10.0]))
casos.append(("una sola diferencia", [1.0, 1.0, 1.0, 2.0], [1.0, 1.0, 2.0, 2.0]))
casos.append(("tamaños muy distintos", rng.normal(10, 1, 4).round(2).tolist(), rng.normal(10.5, 1, 45).round(2).tolist()))
casos.append(("microsegundos", (rng.normal(850, 40, 18) / 1000).round(5).tolist(), (rng.normal(820, 40, 18) / 1000).round(5).tolist()))
casos.append(("negativos y ceros", [-3.0, -1.5, 0.0, 0.0, 2.5, 4.0, -0.5], [-2.0, 0.0, 1.0, 1.0, 3.5, 5.0, 0.5, 2.0]))
casos.append(("grandes", rng.normal(1e6, 5e4, 33).round(1).tolist(), rng.normal(1.02e6, 5e4, 29).round(1).tolist()))
casos.append(("dos valores", [10.0, 12.0], [11.0, 13.0]))

salida = []
for nombre, a, b in casos:
    salida.append({"nombre": nombre, "a": a, "b": b, "da": describir(a), "db": describir(b), "mw": mann_whitney(a, b)})

print(json.dumps({"generado": "numpy " + np.__version__ + ", scipy " + __import__("scipy").__version__, "casos": salida}, ensure_ascii=False, indent=1))
