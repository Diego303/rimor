"""Genera los valores de referencia de @rimor/estadistica con NumPy y SciPy (IN-011).

Uso (con un entorno que tenga numpy y scipy):
    python generar.py > casos.json

Cada caso trae dos series y lo que deben dar: descriptiva de cada una (mediana, media, desviación típica
muestral, coeficiente de variación, mínimo, máximo, percentiles 5, 25, 75 y 95 con interpolación lineal) y la
prueba de Mann-Whitney U bilateral con aproximación normal, corrección por empates y de continuidad; y el
estimador de Hodges-Lehmann con su intervalo de Moses (IN-047).
"""
import json
import math

import numpy as np
from scipy import stats

rng = np.random.default_rng(20261018)


def ic_mediana(v, z=1.96):
    a = np.sort(np.asarray(v, dtype=float))
    n = len(a)
    j = max(1, math.floor(n / 2 - z * math.sqrt(n) / 2))
    k = min(n, math.ceil(1 + n / 2 + z * math.sqrt(n) / 2))
    return [float(a[j - 1]), float(a[k - 1])]


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
        # Fórmula de los rangos de las pantallas de referencia (no hay equivalente en SciPy).
        "ic": ic_mediana(a),
    }


def mann_whitney(x, y):
    r = stats.mannwhitneyu(x, y, alternative="two-sided", method="asymptotic", use_continuity=True)
    return {"u": float(r.statistic), "p": float(r.pvalue)}


def hodges_lehmann(x, y):
    """Hodges-Lehmann de y − x y su intervalo de Moses del 95 % (Hollander y Wolfe), por otro camino que el de
    TypeScript: todas las diferencias con NumPy, y la distribución exacta de U contando arreglos con enteros
    (recurrencia memorizada) o, con empates o m·n > 400, la normal de SciPy con la corrección por empates."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    m, n = len(x), len(y)
    d = np.sort((y[None, :] - x[:, None]).ravel())
    N = m * n
    est = float(np.median(d))
    todos = np.concatenate([x, y])
    empates = len(np.unique(todos)) < len(todos)
    exacto = N <= 400 and not empates
    if exacto:
        from functools import lru_cache

        @lru_cache(maxsize=None)
        def cuenta(mm, nn, u):
            if u < 0:
                return 0
            if mm == 0 or nn == 0:
                return 1 if u == 0 else 0
            return cuenta(mm - 1, nn, u - nn) + cuenta(mm, nn - 1, u)

        total = math.comb(m + n, m)
        k = 0
        acumulado = 0
        while k <= N and (acumulado + cuenta(m, n, k)) / total <= 0.025 + 1e-12:
            acumulado += cuenta(m, n, k)
            k += 1
    else:
        _, t = np.unique(todos, return_counts=True)
        correccion = float(np.sum(t**3 - t))
        varianza = N / 12 * (m + n + 1 - correccion / ((m + n) * (m + n - 1)))
        # Con la corrección de continuidad, como la de Mann-Whitney.
        k = math.floor(N / 2 - stats.norm.ppf(0.975) * math.sqrt(varianza) + 0.5)
    if k < 1:
        return {"estimacion": est, "icBajo": None, "icAlto": None, "exacto": exacto}
    return {"estimacion": est, "icBajo": float(d[k - 1]), "icAlto": float(d[N - k]), "exacto": exacto}


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
casos.append(("un valor", [7.0], [8.0, 9.0, 10.0]))
casos.append(("tres y cuatro", [3.0, 1.0, 2.0], [4.0, 6.0, 5.0, 7.0]))
casos.append(("sin solape grande", list(range(60)), list(range(100, 160))))

salida = []
for nombre, a, b in casos:
    salida.append(
        {
            "nombre": nombre,
            "a": a,
            "b": b,
            "da": describir(a),
            "db": describir(b),
            "mw": mann_whitney(a, b),
            "hl": hodges_lehmann(a, b),
        }
    )

print(json.dumps({"generado": "numpy " + np.__version__ + ", scipy " + __import__("scipy").__version__, "casos": salida}, ensure_ascii=False, indent=1))
