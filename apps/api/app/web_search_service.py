import asyncio
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from app.models import WebSearchResult

DUCKDUCKGO_HTML_URL = "https://duckduckgo.com/html/?q={query}"


class SearchResultParser:
    def __init__(self, html: str) -> None:
        self.html = html

    def parse(self) -> list[WebSearchResult]:
        import re

        results: list[WebSearchResult] = []
        blocks = re.findall(
            r'<a[^>]+class="result__a"[^>]+href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>.*?'
            r'<a[^>]+class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
            self.html,
            re.DOTALL,
        )
        for url, title, snippet in blocks:
            clean_title = self._strip_tags(title)
            clean_snippet = self._strip_tags(snippet)
            if clean_title and url:
                results.append(
                    WebSearchResult(
                        title=clean_title,
                        url=unescape(url),
                        snippet=clean_snippet,
                    )
                )
        return results[:5]

    @staticmethod
    def _strip_tags(value: str) -> str:
        import re

        text = re.sub(r"<[^>]+>", " ", value)
        text = re.sub(r"\s+", " ", unescape(text)).strip()
        return text


def _search_web_sync(query: str) -> list[WebSearchResult]:
    request = Request(
        DUCKDUCKGO_HTML_URL.format(query=quote_plus(query)),
        headers={"User-Agent": "CoevoMeet/0.1"},
    )
    try:
        with urlopen(request, timeout=12) as response:
            html = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        raise RuntimeError(f"Web search returned HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach web search: {exc.reason}") from exc

    return SearchResultParser(html).parse()


async def search_web(query: str) -> list[WebSearchResult]:
    return await asyncio.to_thread(_search_web_sync, query)
