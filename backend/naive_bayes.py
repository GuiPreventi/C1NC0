from __future__ import annotations

import math
import importlib.util
import re
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from fastapi import HTTPException


BASE = Path(__file__).resolve().parent
MODELS = BASE / "models"
MODEL_FILES = ("gaussian_nb_pipeline.joblib", "tfidf_vectorizer.joblib", "multinomial_nb.joblib")


def models_ready() -> bool:
    return all((MODELS / name).is_file() for name in MODEL_FILES)


def page_reading_ready() -> bool:
    return models_ready()

FEATURES_META = [
    "qtd_links_externos", "qtd_dominios_externos", "num_tokens", "num_palavras",
    "num_types", "num_verbos", "num_substantivos", "num_adjetivos", "num_adverbios",
    "num_pronomes", "num_verbos_subjuntivo_imperativo", "num_palavras_maiusculas",
    "num_caracteres", "comprimento_medio_sentenca", "comprimento_medio_palavra",
    "percentual_erros_ortograficos", "emotividade", "diversidade_lexical",
    "coerencia_titulos_pct",
]

FEATURE_LABELS = {
    "qtd_links_externos": "Links externos",
    "qtd_dominios_externos": "Sites externos citados",
    "num_tokens": "Palavras identificadas",
    "num_palavras": "Palavras no texto",
    "num_types": "Palavras diferentes",
    "num_verbos": "Verbos",
    "num_substantivos": "Substantivos e nomes",
    "num_adjetivos": "Adjetivos",
    "num_adverbios": "Advérbios",
    "num_pronomes": "Pronomes",
    "num_verbos_subjuntivo_imperativo": "Verbos de possibilidade ou ordem",
    "num_palavras_maiusculas": "Palavras em maiúsculas",
    "num_caracteres": "Caracteres do texto",
    "comprimento_medio_sentenca": "Palavras por frase, em média",
    "comprimento_medio_palavra": "Letras por palavra, em média",
    "percentual_erros_ortograficos": "Indicação de erros de escrita",
    "emotividade": "Adjetivos e advérbios em relação a verbos e substantivos",
    "diversidade_lexical": "Variedade de palavras",
    "coerencia_titulos_pct": "Palavras do título presentes no texto",
}


@lru_cache(maxsize=1)
def load_models() -> dict:
    files = {"gaussian": MODEL_FILES[0], "vectorizer": MODEL_FILES[1], "multinomial": MODEL_FILES[2]}
    missing = [name for name in files.values() if not (MODELS / name).is_file()]
    if missing:
        raise HTTPException(status_code=503, detail="A leitura automática está temporariamente indisponível.")
    try:
        return {key: joblib.load(MODELS / name) for key, name in files.items()}
    except Exception as exc:
        print(f"Não foi possível carregar os arquivos da análise: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(status_code=503, detail="Os arquivos da análise precisam ser atualizados. Reinicie a aplicação ou confira as dependências do backend.") from exc


@lru_cache(maxsize=1)
def load_portuguese_nlp():
    model_path = MODELS / "pt_core_news_sm"
    if not model_path.is_dir():
        return None
    if importlib.util.find_spec("spacy") is None:
        return None
    try:
        import spacy
        return spacy.load(model_path)
    except Exception as exc:
        print(f"Não foi possível carregar o pacote de idioma: {type(exc).__name__}: {exc}", flush=True)
        return None


def extract_url_features(page: dict, nlp) -> dict[str, float]:
    title = page.get("title") or ""
    body = " ".join(page.get("paragraphs") or [])
    full_text = f"{title} {body}".strip()
    words = re.findall(r"\b[\wÀ-ÿ]+\b", full_text, flags=re.UNICODE)
    lower_words = [word.lower() for word in words]
    sentences = [sentence.strip() for sentence in re.split(r"[.!?]+", full_text) if sentence.strip()]
    sentence_count = max(len(sentences), 1)
    doc = nlp(full_text)

    verbs = sum(token.pos_ == "VERB" for token in doc)
    nouns = sum(token.pos_ in {"NOUN", "PROPN"} for token in doc)
    adjectives = sum(token.pos_ == "ADJ" for token in doc)
    adverbs = sum(token.pos_ == "ADV" for token in doc)
    pronouns = sum(token.pos_ == "PRON" for token in doc)
    subjunctive_or_imperative = sum(
        token.pos_ == "VERB" and any(mood in {"Sub", "Imp"} for mood in token.morph.get("Mood"))
        for token in doc
    )
    content_lemmas = [
        token.lemma_.lower() for token in doc
        if token.pos_ in {"NOUN", "PROPN", "VERB", "ADJ", "ADV"} and token.is_alpha
    ]
    title_words = {word.lower() for word in re.findall(r"\b[\wÀ-ÿ]+\b", title, flags=re.UNICODE)}
    body_words = {word.lower() for word in re.findall(r"\b[\wÀ-ÿ]+\b", body, flags=re.UNICODE)}

    return {
        "qtd_links_externos": float(page.get("external_link_count", 0)),
        "qtd_dominios_externos": float(page.get("external_count", 0)),
        "num_tokens": float(len(words)),
        "num_palavras": float(len(words)),
        "num_types": float(len(set(lower_words))),
        "num_verbos": float(verbs),
        "num_substantivos": float(nouns),
        "num_adjetivos": float(adjectives),
        "num_adverbios": float(adverbs),
        "num_pronomes": float(pronouns),
        "num_verbos_subjuntivo_imperativo": float(subjunctive_or_imperative),
        "num_palavras_maiusculas": float(sum(len(word) > 1 and word.isupper() for word in words)),
        "num_caracteres": float(len(full_text)),
        "comprimento_medio_sentenca": len(words) / sentence_count if words else 0.0,
        "comprimento_medio_palavra": float(np.mean([len(word) for word in words])) if words else 0.0,
        # The notebook relies on LanguageTool/Java for this feature. Preserve it as
        # missing so the fitted pipeline imputes its training-set median.
        "percentual_erros_ortograficos": np.nan,
        "emotividade": (adjectives + adverbs) / (nouns + verbs) if nouns + verbs else 0.0,
        "diversidade_lexical": len(set(content_lemmas)) / len(content_lemmas) if content_lemmas else 0.0,
        "coerencia_titulos_pct": len(title_words & body_words) / len(title_words) * 100 if title_words else 0.0,
    }


def _class_label(value: object) -> str:
    label = str(value).strip().lower()
    return "fake" if label == "fake" else "true" if label == "true" else label


def extract_chart_features(page: dict) -> dict[str, float]:
    """Extract page metrics that do not depend on an optional language package."""
    title = page.get("title") or ""
    body = " ".join(page.get("paragraphs") or [])
    full_text = f"{title} {body}".strip()
    words = re.findall(r"\b[^\W_]+\b", full_text, flags=re.UNICODE)
    lower_words = [word.lower() for word in words]
    title_words = {word.lower() for word in re.findall(r"\b[^\W_]+\b", title, flags=re.UNICODE)}
    body_words = {word.lower() for word in re.findall(r"\b[^\W_]+\b", body, flags=re.UNICODE)}
    sentence_count = max(1, len([part for part in re.split(r"[.!?]+", full_text) if part.strip()]))
    word_types = set(lower_words)
    return {
        "qtd_links_externos": float(page.get("external_link_count", 0)),
        "qtd_dominios_externos": float(page.get("external_count", 0)),
        "num_tokens": float(len(words)), "num_palavras": float(len(words)),
        "num_types": float(len(word_types)), "num_verbos": np.nan,
        "num_substantivos": np.nan, "num_adjetivos": np.nan,
        "num_adverbios": np.nan, "num_pronomes": np.nan,
        "num_verbos_subjuntivo_imperativo": np.nan,
        "num_palavras_maiusculas": float(sum(len(word) > 1 and word.isupper() for word in words)),
        "num_caracteres": float(len(full_text)),
        "comprimento_medio_sentenca": len(words) / sentence_count if words else 0.0,
        "comprimento_medio_palavra": float(np.mean([len(word) for word in words])) if words else 0.0,
        "percentual_erros_ortograficos": np.nan, "emotividade": np.nan,
        "diversidade_lexical": len(word_types) / len(words) if words else 0.0,
        "coerencia_titulos_pct": len(title_words & body_words) / len(title_words) * 100 if title_words else 0.0,
    }


def feature_group_distribution(nb, scaled_row, feature_indices: list[int]) -> dict[str, int]:
    labels = [_class_label(value) for value in nb.classes_]
    scores = []
    for class_index, _label in enumerate(labels):
        score = math.log(max(float(nb.class_prior_[class_index]), 1e-300))
        for feature_index in feature_indices:
            value = float(scaled_row[feature_index])
            variance = max(float(nb.var_[class_index, feature_index]), 1e-12)
            mean = float(nb.theta_[class_index, feature_index])
            score += -0.5 * (math.log(2 * math.pi * variance) + ((value - mean) ** 2) / variance)
        scores.append(score)
    exp_scores = np.exp(np.asarray(scores) - max(scores))
    probabilities = exp_scores / exp_scores.sum()
    true_percent = round(float(probabilities[labels.index("true")]) * 100)
    return {"true": true_percent, "fake": 100 - true_percent}


def analyze_with_naive_bayes(page: dict) -> dict:
    models = load_models()
    content = f"{page.get('title') or ''} {' '.join(page.get('paragraphs') or [])}".strip()
    text_vector = models["vectorizer"].transform([content])
    text_model = models["multinomial"]
    text_class = _class_label(text_model.predict(text_vector)[0])
    text_labels = [_class_label(value) for value in text_model.classes_]
    text_probabilities = text_model.predict_proba(text_vector)[0]
    true_percent = round(float(text_probabilities[text_labels.index("true")]) * 100)
    text_distribution = {"true": true_percent, "fake": 100 - true_percent}
    disclaimer = "Esta leitura é um apoio para observar a notícia. Ela não confirma os fatos nem determina, sozinha, se a notícia é verdadeira ou falsa."

    def text_only_result() -> dict:
        return {
            "textClass": text_class,
            "textDistribution": text_distribution,
            "metricDistributions": None,
            "metricValues": None,
            "pageClass": None,
            "agreement": None,
            "featureVotes": {"true": 0, "fake": 0, "neutral": 0},
            "featureEvidence": [],
            "featureCount": 0,
            "pageReadingAvailable": False,
            "disclaimer": disclaimer,
        }

    try:
        features = extract_chart_features(page)
        feature_vector = np.asarray([[features.get(name, np.nan) for name in FEATURES_META]], dtype=float)
        gaussian_pipeline = models["gaussian"]
        gaussian_class = _class_label(gaussian_pipeline.predict(feature_vector)[0])
        nb = gaussian_pipeline.steps[-1][1]
        scaled = gaussian_pipeline[:-1].transform(feature_vector)
        classes = [_class_label(value) for value in nb.classes_]
        true_index, fake_index = classes.index("true"), classes.index("fake")
        votes = {"true": 0, "fake": 0, "neutral": 0}
        feature_evidence = []
        observed_features = 0

        for index, feature in enumerate(FEATURES_META):
            value = scaled[0, index]
            var_true = max(float(nb.var_[true_index, index]), 1e-12)
            var_fake = max(float(nb.var_[fake_index, index]), 1e-12)
            log_true = -0.5 * (math.log(2 * math.pi * var_true) + ((value - nb.theta_[true_index, index]) ** 2) / var_true)
            log_fake = -0.5 * (math.log(2 * math.pi * var_fake) + ((value - nb.theta_[fake_index, index]) ** 2) / var_fake)
            evidence = float(log_true - log_fake)
            direction = "true" if evidence > 0 else "fake" if evidence < 0 else "neutral"
            available = bool(np.isfinite(feature_vector[0, index]))
            if available:
                votes[direction] += 1
                observed_features += 1
            feature_evidence.append({"name": FEATURE_LABELS[feature], "direction": direction, "available": available})
    except Exception as exc:
        print(f"Leitura complementar indisponível: {type(exc).__name__}: {exc}", flush=True)
        return text_only_result()

    metric_distributions = {
        "links": feature_group_distribution(nb, scaled[0], [FEATURES_META.index("qtd_links_externos"), FEATURES_META.index("qtd_dominios_externos")]),
        "titleContent": feature_group_distribution(nb, scaled[0], [FEATURES_META.index("num_palavras"), FEATURES_META.index("diversidade_lexical"), FEATURES_META.index("coerencia_titulos_pct")]),
    }
    return {
        "textClass": text_class,
        "textDistribution": text_distribution,
        "metricDistributions": metric_distributions,
        "metricValues": {"wordCount": int(features["num_palavras"]), "undestinedLinks": int(page.get("undestined_link_count", 0)), "totalLinks": int(page.get("total_link_count", 0)), "undestinedLinkRate": round(page.get("undestined_link_count", 0) / page.get("total_link_count", 1) * 100) if page.get("total_link_count", 0) else 0, "externalLinks": int(page.get("external_link_count", 0)), "externalDomains": int(page.get("external_count", 0)), "titleCoherence": int(round(features["coerencia_titulos_pct"])), "lexicalDiversity": int(round(features["diversidade_lexical"] * 100))},
        "pageClass": gaussian_class,
        "agreement": text_class == gaussian_class,
        "featureVotes": votes,
        "featureEvidence": feature_evidence,
        "featureCount": observed_features,
        "pageReadingAvailable": True,
        "disclaimer": disclaimer,
    }
