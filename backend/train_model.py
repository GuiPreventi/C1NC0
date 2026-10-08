"""Train the C1NC0 title novelty pipeline and save its inference artifacts.

Set C1NC0_TRAINING_CSV to the training CSV path before running this script.
"""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import MinMaxScaler


ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
CSV_PATH = os.environ.get("C1NC0_TRAINING_CSV")
MAX_FEATURES = 5_000
N_COMPONENTS = 100
CONTAMINATION = 0.10
CANDIDATE_NEIGHBORS = [10, 15, 20, 30, 50]


def main() -> None:
    if not CSV_PATH:
        raise SystemExit("Defina C1NC0_TRAINING_CSV com o caminho do CSV de treinamento.")

    dataset = pd.read_csv(CSV_PATH, sep=None, engine="python", on_bad_lines="skip")
    if "titulo" not in dataset.columns:
        raise ValueError(f"Coluna 'titulo' ausente. Encontradas: {list(dataset.columns)}")

    titles = dataset["titulo"].dropna().astype(str).str.strip()
    titles = titles[titles.ne("")].reset_index(drop=True)
    if len(titles) < 52:
        raise ValueError("O treinamento exige pelo menos 52 títulos para avaliar os vizinhos configurados.")

    print(f"Treinando com {len(titles):,} títulos...")
    tfidf = TfidfVectorizer(max_features=MAX_FEATURES, ngram_range=(1, 2), min_df=3, lowercase=True)
    tfidf_matrix = tfidf.fit_transform(titles)
    component_count = min(N_COMPONENTS, tfidf_matrix.shape[0] - 1, tfidf_matrix.shape[1] - 1)
    if component_count < 2:
        raise ValueError("Há poucos títulos ou termos para executar a redução SVD.")

    svd = TruncatedSVD(n_components=component_count, random_state=42)
    reduced = svd.fit_transform(tfidf_matrix)
    results: list[tuple[float, int]] = []
    for neighbors in CANDIDATE_NEIGHBORS:
        if neighbors >= len(reduced):
            continue
        candidate = LocalOutlierFactor(n_neighbors=neighbors, contamination=CONTAMINATION, novelty=True, n_jobs=-1)
        candidate.fit(reduced)
        scores = -candidate.negative_outlier_factor_
        outlier_mask = candidate.negative_outlier_factor_ < candidate.offset_
        outlier_scores, normal_scores = scores[outlier_mask], scores[~outlier_mask]
        separation = float(outlier_scores.mean() - normal_scores.mean()) if len(outlier_scores) and len(normal_scores) else 0.0
        results.append((separation, neighbors))

    if not results:
        raise ValueError("Não foi possível selecionar n_neighbors para este conjunto.")
    best_neighbors = max(results)[1]
    lof = LocalOutlierFactor(n_neighbors=best_neighbors, contamination=CONTAMINATION, novelty=True, n_jobs=-1)
    lof.fit(reduced)
    training_scores = -lof.negative_outlier_factor_
    scaler = MinMaxScaler().fit(training_scores.reshape(-1, 1))
    config = {"coluna_texto": "titulo", "n_neighbors": best_neighbors, "contamination": CONTAMINATION, "n_componentes": component_count, "training_rows": len(titles)}

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, artifact in {"tfidf_lof.pkl": tfidf, "svd_lof.pkl": svd, "modelo_lof.pkl": lof, "scaler_lof.pkl": scaler, "configuracao_lof.pkl": config}.items():
        joblib.dump(artifact, MODEL_DIR / name)
        print(f"Salvo: {MODEL_DIR / name}")
    print(f"Treinamento concluído; n_neighbors={best_neighbors}; componentes SVD={component_count}.")


if __name__ == "__main__":
    main()
