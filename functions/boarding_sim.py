"""boarding_sim.py — publiczne API modułu boardingu (fasada).

Re-eksportuje wszystkie nazwy używane przez main.py, zachowując
pełną kompatybilność wsteczną importów. Logika implementacyjna
przeniesiona do boarding_tick.py i boarding_rollover.py.
"""

from boarding_tick import run_boarding_tick
from boarding_rollover import run_boarding_rollover, _clear_daily_boarding_state
from schedule_builder import rebuild_schedule_table, rebuild_schedule_for_trainset

__all__ = [
    'run_boarding_tick',
    'run_boarding_rollover',
    '_clear_daily_boarding_state',
    'rebuild_schedule_table',
    'rebuild_schedule_for_trainset',
]
