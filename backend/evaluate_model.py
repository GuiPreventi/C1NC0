"""Apply the trained title model to the provided held-out CSV."""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app import MODELS


TEST_CSV = os.environ.get("C1NC0_TEST_CSV")


def main() -> None:
    if not TEST_CSV:
        raise SystemExit("Defina C1NC0_TEST_CSV com o caminho do CSV reservado para teste.")
    test = pd.read_csv(TEST_CSV, sep=None, engine="python", on_bad_lines="skip")
    if "titulo" not in test.columns:
        raise ValueError(f"Coluna 'titulo' ausente. Encontradas: {list(test.columns)}")
    titles = test["titulo"].fillna("").astype(str)
    valid = titles.str.strip().ne("")
    test = test.loc[valid].copy().reset_index(drop=True)
    titles = titles.loc[valid].reset_index(drop=True)

    tfidf = joblib.load(MODELS / "tfidf_lof.pkl")
    svd = joblib.load(MODELS / "svd_lof.pkl")
    lof = joblib.load(MODELS / "modelo_lof.pkl")
    scaler = joblib.load(MODELS / "scaler_lof.pkl")
    reduced = svd.transform(tfidf.transform(titles))
    raw = -lof.score_samples(reduced)
    test["score_variacao_titulo"] = np.clip(scaler.transform(raw.reshape(-1, 1)).ravel(), 0, 1)
    test["faixa_variacao"] = pd.cut(test["score_variacao_titulo"], bins=[-0.001, 0.33, 0.66, 1.001], labels=["baixa", "média", "alta"], right=False)

    output = Path(__file__).resolve().parent / "evaluation_results.csv"
    test.to_csv(output, index=False)
    print(f"Avaliação aplicada a {len(test)} títulos; resultado salvo em {output}.")
    print("Distribuição das faixas (indicador de variação, não de veracidade):")
    print(test["faixa_variacao"].value_counts(dropna=False).to_string())


if __name__ == "__main__":
    main()

