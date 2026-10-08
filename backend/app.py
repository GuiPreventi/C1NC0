from __future__ import annotations

import ipaddress
import os
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

from .naive_bayes import analyze_with_naive_bayes, models_ready, page_reading_ready


app = FastAPI(title="C1NC0 Analysis API", version="1.0.0")
API_REVISION = "c1nc0-2026-10-08-vercel-deploy-1"
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("C1NC0_ALLOWED_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class AnalyzeRequest(BaseModel):
    url: HttpUrl


def assert_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="Informe uma URL pública HTTP ou HTTPS válida.")
    try:
        addresses = {ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise HTTPException(status_code=422, detail="Não foi possível localizar o domínio informado.") from exc
    if not addresses or any(not address.is_global for address in addresses):
        raise HTTPException(status_code=422, detail="A URL precisa apontar para um domínio público.")


def fetch_page(url: str, tried_hosts: set[str] | None = None) -> tuple[str, str]:
    current = url
    tried_hosts = tried_hosts or set()
    headers = {"User-Agent": "C1NC0ResearchBot/1.0 (+information literacy analysis)"}
    try:
        with httpx.Client(timeout=12, follow_redirects=False, headers=headers) as client:
            for _ in range(4):
                assert_public_url(current)
                response = client.get(current)
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        break
                    current = urljoin(current, location)
                    continue
                response.raise_for_status()
                if len(response.content) > 4_000_000:
                    raise HTTPException(status_code=413, detail="A página excede o limite de tamanho para análise.")
                return response.text, str(response.url)
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in {401, 403, 429}:
            detail = "Este site não permitiu a leitura automática da matéria. Tente outra notícia ou confira o conteúdo diretamente no site."
        elif status == 404:
            detail = "Esta página não foi encontrada. Confira se o endereço está correto e se a notícia continua disponível."
        else:
            detail = "O site não conseguiu entregar esta página agora. Tente novamente mais tarde ou use outra notícia."
        print(f"Page fetch returned HTTP {status} for {urlparse(current).hostname}", flush=True)
        raise HTTPException(status_code=422, detail=detail) from exc
    except httpx.TimeoutException as exc:
        print(f"Page fetch timed out for {urlparse(current).hostname}", flush=True)
        raise HTTPException(status_code=422, detail="O site demorou para responder. Tente novamente mais tarde ou use outra notícia.") from exc
    except httpx.HTTPError as exc:
        parsed = urlparse(current)
        if "hostname mismatch" in str(exc).lower():
            host = parsed.hostname
            if host and host not in tried_hosts:
                tried_hosts.add(host)
                try:
                    ipaddress.ip_address(host)
                    alternate_host = None
                except ValueError:
                    labels = host.split(".")
                    is_common_country_domain = host.endswith((".com.br", ".org.br", ".net.br", ".gov.br"))
                    if host.startswith("www."):
                        alternate_host = host[4:]
                    elif len(labels) <= 2 or (is_common_country_domain and len(labels) == 3):
                        alternate_host = f"www.{host}"
                    else:
                        alternate_host = None
                if alternate_host and alternate_host not in tried_hosts:
                    port = f":{parsed.port}" if parsed.port else ""
                    alternate = parsed._replace(netloc=f"{alternate_host}{port}").geturl()
                    print(f"TLS hostname mismatch for {host}; retrying the www alternative {alternate_host}", flush=True)
                    return fetch_page(alternate, tried_hosts)
            raise HTTPException(status_code=422, detail="Este site não apresentou uma conexão segura válida para esse endereço. Tente outra notícia ou acesse a página diretamente pelo site da publicação.") from exc
        print(f"Page fetch failed for {urlparse(current).hostname}: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(status_code=422, detail="Não foi possível abrir esta página agora. Confira se o endereço está correto ou tente outra notícia.") from exc
    raise HTTPException(status_code=422, detail="A página redirecionou muitas vezes e não pôde ser analisada.")


def meta(soup: BeautifulSoup, *keys: str) -> str | None:
    for key in keys:
        tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return None


def extract_key_points(paragraphs: list[str]) -> list[str]:
    sentences = [sentence.strip() for paragraph in paragraphs for sentence in re.split(r"(?<=[.!?])\s+", paragraph)]
    sentences = [sentence for sentence in sentences if 55 <= len(sentence) <= 360]
    marked = [sentence for sentence in sentences if re.search(r"\d|%|R\$|US\$|‘|’|“|”|\"|segundo|de acordo|afirmou|disse|informou|aponta|mostra|estudo|pesquisa", sentence, re.IGNORECASE)]
    selected: list[str] = []
    for sentence in marked + sentences:
        normalized = re.sub(r"\W+", " ", sentence.lower()).strip()
        if normalized and all(re.sub(r"\W+", " ", existing.lower()).strip() != normalized for existing in selected):
            words = sentence.split()
            selected.append(" ".join(words[:22]).rstrip() + ("…" if len(words) > 22 else ""))
        if len(selected) == 4:
            break
    return selected


def build_checklist(page: dict, key_points: list[str]) -> list[dict[str, str]]:
    short_title = page["title"].strip().rstrip(".!? ")[:150]
    if len(page["title"]) > 150:
        short_title += "…"
    detail = next((point for point in key_points if re.search(r"\d|%|R\$|US\$", point)), None) or (key_points[0] if key_points else None)
    if detail:
        detail = detail[:150].rstrip().rstrip(".!? ") + ("…" if len(detail) > 150 else "")
        detail_question = f'A matéria afirma que “{detail}”. Você consegue localizar essa informação na fonte original?'
    else:
        detail_question = "O texto apresenta algum dado, documento ou fala que possa ser conferido em uma fonte original?"

    text = f"{page['title']} {page['summary']} {' '.join(key_points)}".lower()
    topic_questions = [
        (r"saúde|hospital|médic|vacina|doença|tratamento|paciente", "O estudo, serviço de saúde ou profissional citado confirma a informação e explica seus limites?"),
        (r"eleição|presidente|governo|ministério|prefeito|congresso|senador", "A fala ou decisão mencionada pode ser conferida no registro, documento ou pronunciamento original?"),
        (r"futebol|jogo|gol|campeonato|atleta|time", "O resultado ou número citado corresponde aos dados oficiais da competição?"),
        (r"dólar|inflação|economia|empresa|preço|bilhão|mercado|renda", "Os números da matéria indicam período, unidade e fonte, e coincidem com a fonte original?"),
        (r"clima|temperatura|chuva|ambient|aquecimento|seca", "Os dados citam o local, o período e a fonte das medições?"),
        (r"polícia|morte|crime|suspeito|prisão|justiça|tribunal", "O texto diferencia suspeitas e acusações de fatos confirmados por documentos ou decisões?"),
        (r"estudo|pesquisa|científic|universidade", "O estudo citado sustenta a afirmação principal e apresenta limites ou ressalvas?"),
    ]
    topic_question = next((question for pattern, question in topic_questions if re.search(pattern, page["title"], re.IGNORECASE)), None)
    if topic_question is None:
        matches = [(len(re.findall(pattern, text, re.IGNORECASE)), question) for pattern, question in topic_questions]
        topic_question = max(matches, default=(0, ""))[1] or "A informação principal do título aparece explicada e apoiada por fontes identificáveis no texto?"

    if page["external_count"]:
        source_question = f"Os links para {page['external_domains'][0]} e os demais sites citados levam às fontes originais das informações?"
    else:
        source_question = "A matéria não apresenta links para outros sites. Você consegue localizar a fonte original das informações?"

    date_question = "A data de publicação indicada na página é coerente com o período dos acontecimentos descritos?" if page["date"] != "Data não identificada" else "A data de publicação está indicada? Ela combina com o período dos acontecimentos descritos?"
    author_question = "É possível confirmar quem escreveu a matéria e encontrar as fontes usadas?" if page["author"] else "A autoria não aparece nesta página. Você consegue encontrar quem escreveu e quais fontes foram usadas?"
    return [
        {"id": "main-claim", "text": f'O texto apresenta dados, documentos ou fontes que sustentem a afirmação do título: “{short_title}”?'.replace("“…”", "…")},
        {"id": "specific-detail", "text": detail_question},
        {"id": "original-sources", "text": source_question},
        {"id": "topic-check", "text": topic_question},
        {"id": "publication-date", "text": date_question},
        {"id": "author", "text": author_question},
    ]


def build_attention_points(page: dict) -> list[dict[str, str]]:
    points: list[dict[str, str]] = []
    if page["word_count"] < 100:
        points.append({
            "title": "Texto curto",
            "detail": f"A página trouxe cerca de {page['word_count']} palavras de conteúdo. Textos curtos podem deixar contexto importante de fora.",
        })
    if page["undestined_link_count"]:
        count = page["undestined_link_count"]
        points.append({
            "title": "Links sem destino",
            "detail": f"Encontramos {count} {'link' if count == 1 else 'links'} sem um endereço de destino utilizável. Eles não permitem abrir a referência indicada.",
        })
    if not page["external_count"]:
        points.append({
            "title": "Sem links para fontes externas",
            "detail": "A página não aponta para outros sites. Procure a fonte original dos dados ou declarações citados.",
        })
    if not page["author"]:
        points.append({
            "title": "Autoria não identificada",
            "detail": "Não encontramos o nome de quem escreveu a matéria nos dados da página.",
        })
    if page["date"] == "Data não identificada":
        points.append({
            "title": "Data não identificada",
            "detail": "Não encontramos a data de publicação. Sem ela, pode ser mais difícil saber se a informação está atualizada.",
        })
    if not points:
        points.append({
            "title": "Nenhum destes pontos foi identificado",
            "detail": "A página trouxe texto, links e dados básicos de publicação. Isso, por si só, não confirma as informações da notícia.",
        })
    return points


def analyze_page(url: str, html: str, final_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header", "form"]):
        tag.decompose()
    title_tag = soup.find("h1")
    title = meta(soup, "og:title", "twitter:title") or (title_tag.get_text(" ", strip=True) if title_tag else None) or (soup.title.get_text(" ", strip=True) if soup.title else "Título não identificado")
    image_value = meta(soup, "og:image", "og:image:url", "twitter:image", "twitter:image:src")
    if not image_value:
        image_tag = (soup.find("article") or soup.find("main") or soup).find("img", src=True)
        image_value = str(image_tag.get("src", "")).strip() if image_tag else None
    image_url = urljoin(final_url, image_value) if image_value else None
    if image_url and urlparse(image_url).scheme not in {"http", "https"}:
        image_url = None
    description = meta(soup, "description", "og:description", "twitter:description")
    article = soup.find("article") or soup.find("main") or soup
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(" ", strip=True)) >= 30]
    body_text = " ".join(paragraphs)
    summary = description or " ".join(paragraphs[:2])[:700] or "Não foi possível extrair um resumo textual desta página."
    author = meta(soup, "author", "article:author", "parsely-author")
    date_value = meta(soup, "article:published_time", "date", "datePublished", "pubdate")
    if not date_value:
        date_tag = soup.find("time")
        date_value = (date_tag.get("datetime") or date_tag.get_text(" ", strip=True)) if date_tag else None
    domain = urlparse(final_url).hostname or urlparse(url).hostname or "domínio não identificado"
    original_domain = urlparse(final_url).hostname
    anchors = soup.find_all("a")
    undestined_link_count = 0
    for anchor in anchors:
        href = str(anchor.get("href") or "").strip().lower()
        if not href or href == "#" or href.startswith("javascript:"):
            undestined_link_count += 1
    all_links = [urljoin(final_url, str(a.get("href"))) for a in anchors if a.get("href")]
    external_links = {link for link in all_links if urlparse(link).scheme in {"http", "https"} and urlparse(link).hostname and urlparse(link).hostname != original_domain}
    external_domains = {urlparse(link).hostname for link in external_links if urlparse(link).hostname}
    internal_links = sum(1 for link in all_links if urlparse(link).hostname == original_domain)
    return {"title": title[:500], "summary": summary[:1200], "domain": domain.removeprefix("www."), "date": date_value or "Data não identificada", "author": author, "imageUrl": image_url, "paragraphs": paragraphs, "word_count": len(body_text.split()), "external_domains": sorted(external_domains), "external_link_count": len(external_links), "external_count": len(external_domains), "internal_count": internal_links, "undestined_link_count": undestined_link_count, "total_link_count": len(anchors), "sourceUrl": final_url}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "api_revision": API_REVISION, "model_ready": models_ready(), "page_reading_ready": page_reading_ready(), "model": "naive_bayes_v1"}


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict:
    url = str(request.url)
    assert_public_url(url)
    html, final_url = fetch_page(url)
    page = analyze_page(url, html, final_url)
    naive_bayes = analyze_with_naive_bayes(page)
    key_points = extract_key_points(page["paragraphs"])
    checklist = build_checklist(page, key_points)
    attention_points = build_attention_points(page)
    observations = [f"Foram encontrados {len(page['paragraphs'])} parágrafos e cerca de {page['word_count']} palavras no texto disponível."]
    if page["word_count"] < 80:
        observations.append("O texto encontrado é curto. Por isso, alguns elementos podem não aparecer nesta leitura.")
    external_text = ", ".join(page["external_domains"][:5]) or "Nenhum outro site foi encontrado entre os links da página."
    unknowns = ["Os links aparecem nesta página, mas seu conteúdo não foi aberto para confirmar as informações.", "Esta análise não confere as afirmações com outras fontes independentes."]
    if len(page["paragraphs"]) < 2:
        unknowns.append("A página trouxe pouco texto para observar a matéria por inteiro.")
    if not page["external_count"]:
        unknowns.append("Não foram encontrados links para outros sites nesta página.")
    if not page["author"]:
        unknowns.append("Não foi possível identificar quem escreveu a matéria nos dados da página.")
    if page["date"] == "Data não identificada":
        unknowns.append("Não foi possível encontrar a data de publicação na página.")
    return {
        "title": page["title"], "summary": page["summary"], "domain": page["domain"], "date": page["date"], "author": page["author"], "sourceUrl": page["sourceUrl"], "imageUrl": page["imageUrl"], "keyPoints": key_points, "checklist": checklist, "attentionPoints": attention_points,
        "naiveBayes": naive_bayes,
        "evidence": [
            {"title": "Coerência", "detail": "Organização do texto", "value": f"{len(page['paragraphs'])} parágrafos", "icon": "coherence", "tone": "mint", "bullets": observations},
            {"title": "Links", "detail": "Outros sites citados", "value": f"{page['external_count']} sites", "icon": "links", "tone": "blue", "bullets": [f"{page['internal_count']} links levam a outras páginas do mesmo site.", f"{page['external_count']} outros sites foram encontrados.", f"Sites citados: {external_text}"]},
            {"title": "Origem", "detail": "Site da publicação", "value": page["domain"], "icon": "origin", "tone": "violet", "bullets": [f"Endereço do site: {page['domain']}.", f"Autor: {page['author'] or 'não identificado na página'}."]},
            {"title": "Data", "detail": "Data de publicação", "value": "Data encontrada" if page["date"] != "Data não identificada" else "Sem data identificada", "icon": "date", "tone": "amber", "bullets": [f"Data que aparece na página: {page['date']}.", "A ferramenta identifica a data indicada pelo site, mas não confirma quando os fatos aconteceram."]},
        ],
        "unknowns": unknowns,
    }


DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
if os.path.isdir(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
