"""observability — structured metrics, tracing and logging for XPS platform."""

from .observability import (
    ObservabilitySystem,
    MetricType,
    Span,
    get_observability,
    record_metric,
    start_span,
    get_metrics_snapshot,
)

__all__ = [
    "ObservabilitySystem",
    "MetricType",
    "Span",
    "get_observability",
    "record_metric",
    "start_span",
    "get_metrics_snapshot",
]
