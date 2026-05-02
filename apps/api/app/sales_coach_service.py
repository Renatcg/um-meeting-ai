from dataclasses import dataclass

from app.models import (
    RecommendationKind,
    RecommendationSeverity,
    TranscriptSegment,
)


@dataclass(frozen=True)
class RecommendationDraft:
    kind: RecommendationKind
    severity: RecommendationSeverity
    title: str
    recommendation: str
    evidence: str


OBJECTION_TERMS = (
    "caro",
    "preco",
    "orcamento",
    "sem budget",
    "nao tenho verba",
    "nao vale",
    "concorrente",
)

RISK_TERMS = (
    "cancelar",
    "risco",
    "problema",
    "nao funciona",
    "atraso",
    "juridico",
    "seguranca",
    "compliance",
)

OPPORTUNITY_TERMS = (
    "urgente",
    "precisamos",
    "queremos",
    "proxima semana",
    "piloto",
    "contratar",
    "fechar",
    "expandir",
)


def analyze_segment(segment: TranscriptSegment) -> list[RecommendationDraft]:
    content = segment.content.strip()
    normalized = content.lower()
    recommendations: list[RecommendationDraft] = []

    if any(term in normalized for term in OBJECTION_TERMS):
        recommendations.append(
            RecommendationDraft(
                kind="objection",
                severity="high" if "concorrente" in normalized else "medium",
                title="Objecao detectada",
                recommendation=(
                    "Reconheca a preocupacao, confirme o impacto financeiro e "
                    "conecte o valor da solucao a um resultado concreto."
                ),
                evidence=content,
            )
        )

    if any(term in normalized for term in RISK_TERMS):
        recommendations.append(
            RecommendationDraft(
                kind="risk",
                severity="high",
                title="Risco na conversa",
                recommendation=(
                    "Peca detalhes do risco, valide quem precisa aprovar e combine "
                    "um proximo passo objetivo para destravar a decisao."
                ),
                evidence=content,
            )
        )

    if any(term in normalized for term in OPPORTUNITY_TERMS):
        recommendations.append(
            RecommendationDraft(
                kind="opportunity",
                severity="medium",
                title="Oportunidade de avanco",
                recommendation=(
                    "Aproveite o sinal de interesse para propor um piloto, mapear "
                    "criterios de sucesso e marcar a proxima reuniao."
                ),
                evidence=content,
            )
        )

    return recommendations
