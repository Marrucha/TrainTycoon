"""Unit tests for pure helper functions in staff.py.

Run with:  pytest functions/tests/
"""

import math
import random
import sys
import os

import pytest

# Make sure the functions package is importable regardless of working directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from staff import (
    advance_exp,
    effective_exp,
    calc_gapowicze_delta,
    apply_gapowicze,
    calc_fine_revenue,
    calc_wars_revenue,
    calc_inspection_index,
    calc_raw_comfort,
    calc_severance,
    calc_evaluation_salary,
    generate_candidate_exp,
)


# ---------------------------------------------------------------------------
# Experience growth
# ---------------------------------------------------------------------------

class TestAdvanceExp:
    def test_from_zero(self):
        assert advance_exp(0) == pytest.approx(5.0)       # (100-0)*0.05

    def test_from_eighty(self):
        assert advance_exp(80) == pytest.approx(81.0)     # 80+(100-80)*0.05

    def test_near_hundred_clamped(self):
        assert advance_exp(99.9) <= 100.0

    def test_already_hundred(self):
        assert advance_exp(100) == pytest.approx(100.0)

    def test_monotonically_increasing(self):
        for e in range(0, 100, 10):
            assert advance_exp(float(e)) > float(e)


class TestEffectiveExp:
    def test_no_kierownik_boost(self):
        # kierownik_exp=0 → no boost
        assert effective_exp(40.0, 0.0) == pytest.approx(40.0)

    def test_kierownik_boost(self):
        # worker=40, kierownik=60 → min(100, 40*(1+60/100)) = 64
        assert effective_exp(40.0, 60.0) == pytest.approx(64.0)

    def test_capped_at_100(self):
        # worker=80, kierownik=80 → 80*(1+0.8) = 144 → capped at 100
        assert effective_exp(80.0, 80.0) == pytest.approx(100.0)

    def test_low_worker_high_kierownik(self):
        # worker=10, kierownik=100 → 10*2.0 = 20.0
        assert effective_exp(10.0, 100.0) == pytest.approx(20.0)


# ---------------------------------------------------------------------------
# Gapowicze delta
# ---------------------------------------------------------------------------

class TestGapowiczeDelta:
    """Verify the formula with exp=0 conductors (simplest case)."""

    # rate < 0.10 → base = 0.005
    def test_no_conductor_below_10pct(self):
        # rate=0.05, 4 kursy, 0 cond, 6 wagons
        # growth = 0.005*4 = 0.02; reduction = 0; uncovered = 0 (n_cond=0 → (6-0)/6=1 → 1*0.005*4=0.02)
        # net = 0.02 - 0 + 0.02 = 0.04
        # Wait: uncovered = max((6 - 6*0)/6, 0) * base * n_kursy = 1.0 * 0.005 * 4 = 0.02
        # net = 0.02 - 0 + 0.02 = 0.04
        delta = calc_gapowicze_delta(rate=0.05, n_kursy=4, n_cond=0, n_wagons=6)
        assert delta == pytest.approx(0.04)

    def test_one_conductor_exact_coverage(self):
        # 1 cond (exp=0), 6 wagons, rate=0.05, 4 kursy
        # base=0.005; growth=0.02
        # reduction = (1/1) * 0.005*4 * (1+0/100) = 0.02
        # uncovered = max((6-6)/6, 0) * 0.005*4 = 0
        # net = 0.02 - 0.02 + 0 = 0.0
        delta = calc_gapowicze_delta(
            rate=0.05, n_kursy=4, n_cond=1, n_wagons=6, cond_exps=[0.0]
        )
        assert delta == pytest.approx(0.0)

    def test_overcrowded_wagons(self):
        # 1 cond (exp=0), 12 wagons, rate=0.05, 4 kursy
        # base=0.005; growth=0.02
        # reduction = 0.02
        # uncovered = max((12-6)/12, 0) * 0.005 * 4 = 0.5 * 0.02 = 0.01
        # net = 0.02 - 0.02 + 0.01 = 0.01
        delta = calc_gapowicze_delta(
            rate=0.05, n_kursy=4, n_cond=1, n_wagons=12, cond_exps=[0.0]
        )
        assert delta == pytest.approx(0.01)

    def test_three_conductors_decrease(self):
        # 3 cond (exp=0 each), 6 wagons, rate=0.05, 4 kursy
        # growth=0.02; uncovered=0
        # reduction = (1 + 1/2 + 1/4) * 0.005*4 * 1.0 = 1.75 * 0.02 = 0.035
        # net = 0.02 - 0.035 = -0.015
        delta = calc_gapowicze_delta(
            rate=0.05, n_kursy=4, n_cond=3, n_wagons=6, cond_exps=[0.0, 0.0, 0.0]
        )
        assert delta < 0

    def test_threshold_switch_10_to_20(self):
        # rate=0.09 → base=0.005; rate=0.11 → base=0.004
        d1 = calc_gapowicze_delta(rate=0.09, n_kursy=2, n_cond=0, n_wagons=6)
        d2 = calc_gapowicze_delta(rate=0.11, n_kursy=2, n_cond=0, n_wagons=6)
        # d1: growth=0.01, uncovered=0.01 → 0.02; d2: growth=0.008, uncovered=0.008 → 0.016
        assert d1 == pytest.approx(0.02)
        assert d2 == pytest.approx(0.016)

    def test_threshold_switch_20_to_30(self):
        # rate=0.19 → base=0.004; rate=0.21 → base=0.003
        d1 = calc_gapowicze_delta(rate=0.19, n_kursy=2, n_cond=0, n_wagons=6)
        d2 = calc_gapowicze_delta(rate=0.21, n_kursy=2, n_cond=0, n_wagons=6)
        assert d1 == pytest.approx(0.016)   # 2 * 0.004*2
        assert d2 == pytest.approx(0.012)   # 2 * 0.003*2

    def test_threshold_30_to_50(self):
        # rate=0.31 → base=0.001
        d = calc_gapowicze_delta(rate=0.31, n_kursy=2, n_cond=0, n_wagons=6)
        assert d == pytest.approx(0.004)    # 2 * 0.001*2

    def test_conductor_with_experience_reduces_more(self):
        delta_no_exp = calc_gapowicze_delta(
            rate=0.05, n_kursy=4, n_cond=1, n_wagons=6, cond_exps=[0.0]
        )
        delta_exp50 = calc_gapowicze_delta(
            rate=0.05, n_kursy=4, n_cond=1, n_wagons=6, cond_exps=[50.0]
        )
        assert delta_exp50 < delta_no_exp


class TestApplyGapowicze:
    def test_clamp_upper(self):
        assert apply_gapowicze(rate=0.49, delta=0.05) == pytest.approx(0.5)

    def test_clamp_lower(self):
        assert apply_gapowicze(rate=0.01, delta=-0.05) == pytest.approx(0.0)

    def test_no_clamp_needed(self):
        assert apply_gapowicze(rate=0.10, delta=0.05) == pytest.approx(0.15)


# ---------------------------------------------------------------------------
# Fine revenue
# ---------------------------------------------------------------------------

class TestFineRevenue:
    def test_basic(self):
        # 300 pass, rate=0.10, 1 cond, 60 min, penalty=15 → max_fines=4
        # evaders=30, actual=4, revenue=4*20*10=800
        assert calc_fine_revenue(
            passengers=300, rate=0.10, n_cond=1,
            duration_min=60, penalty_min=15,
            fine_multiplier=20, min_segment_price=10,
        ) == pytest.approx(800)

    def test_capped_by_evaders(self):
        # 10 pass, rate=0.10 → 1 evader; max_fines=4 → actual=1 → revenue=200
        assert calc_fine_revenue(
            passengers=10, rate=0.10, n_cond=1,
            duration_min=60, penalty_min=15,
            fine_multiplier=20, min_segment_price=10,
        ) == pytest.approx(200)

    def test_no_conductors(self):
        assert calc_fine_revenue(
            passengers=300, rate=0.20, n_cond=0,
            duration_min=60, penalty_min=15,
            fine_multiplier=20, min_segment_price=10,
        ) == pytest.approx(0)

    def test_short_course_partial_penalties(self):
        # 60 min, penalty=15 → max_fines per cond = 4 (floor)
        # 14 min course → max_fines = 0
        assert calc_fine_revenue(
            passengers=300, rate=0.10, n_cond=1,
            duration_min=14, penalty_min=15,
            fine_multiplier=20, min_segment_price=10,
        ) == pytest.approx(0)

    def test_two_conductors_doubles_capacity(self):
        # 2 cond, 120 min → max_fines = 2*8 = 16; 30 evaders → actual=16
        rev = calc_fine_revenue(
            passengers=300, rate=0.10, n_cond=2,
            duration_min=120, penalty_min=15,
            fine_multiplier=20, min_segment_price=10,
        )
        assert rev == pytest.approx(16 * 20 * 10)


# ---------------------------------------------------------------------------
# Wars (restaurant car) revenue
# ---------------------------------------------------------------------------

class TestWarsRevenue:
    def test_no_barman(self):
        assert calc_wars_revenue(passengers=300, barmans_exp=[], base_rate=20) == pytest.approx(0.0)

    def test_single_barman_partial_load(self):
        # exp=0 → cap=500; 300 pass → served=300, load=0.6, eff=0.7, rev=300*20*0.7=4200
        result = calc_wars_revenue(passengers=300, barmans_exp=[0.0], base_rate=20)
        assert result == pytest.approx(4200.0)

    def test_over_capacity(self):
        # exp=0 → cap=500; 700 pass → served=500, load=1.0, eff=0.5, rev=500*20*0.5=5000
        result = calc_wars_revenue(passengers=700, barmans_exp=[0.0], base_rate=20)
        assert result == pytest.approx(5000.0)

    def test_experienced_barman(self):
        # exp=100 → cap=500*(1+1.0)=1000; 500 pass → served=500
        # load=0.5, eff=0.75, rev=500*20*0.75=7500
        result = calc_wars_revenue(passengers=500, barmans_exp=[100.0], base_rate=20)
        assert result == pytest.approx(7500.0)

    def test_empty_train(self):
        assert calc_wars_revenue(passengers=0, barmans_exp=[50.0], base_rate=20) == pytest.approx(0.0)

    def test_two_barmans_combined_capacity(self):
        # exp=0 each → cap=1000; 400 pass → load=0.4, eff=0.8, rev=400*20*0.8=6400
        result = calc_wars_revenue(passengers=400, barmans_exp=[0.0, 0.0], base_rate=20)
        assert result == pytest.approx(6400.0)


# ---------------------------------------------------------------------------
# Inspection index & comfort score
# ---------------------------------------------------------------------------

class TestInspectionIndex:
    def test_one_conductor(self):
        # 1 cond, 600 pass, 5h, 100/h → idx = 500/600
        idx = calc_inspection_index(n_cond=1, passengers=600, hours=5, cap_per_hour=100)
        assert idx == pytest.approx(500 / 600)

    def test_two_conductors(self):
        # 2 cond, 600 pass, 5h, 100/h → idx = 1000/600
        idx = calc_inspection_index(n_cond=2, passengers=600, hours=5, cap_per_hour=100)
        assert idx == pytest.approx(1000 / 600)

    def test_zero_passengers_no_crash(self):
        # Should not divide by zero
        idx = calc_inspection_index(n_cond=1, passengers=0, hours=1, cap_per_hour=100)
        assert idx == pytest.approx(100.0)

    def test_no_conductors(self):
        idx = calc_inspection_index(n_cond=0, passengers=500, hours=3, cap_per_hour=100)
        assert idx == pytest.approx(0.0)


class TestRawComfort:
    def test_neutral_at_index_one(self):
        assert calc_raw_comfort(avg_idx=1.0) == pytest.approx(5.0)

    def test_max_at_no_inspection(self):
        assert calc_raw_comfort(avg_idx=0.0) == pytest.approx(10.0)

    def test_min_at_index_two(self):
        assert calc_raw_comfort(avg_idx=2.0) == pytest.approx(0.0)

    def test_clamp_above_two(self):
        assert calc_raw_comfort(avg_idx=3.0) == pytest.approx(0.0)

    def test_midpoint(self):
        # idx=0.5 → 5*(2-0.5) = 7.5
        assert calc_raw_comfort(avg_idx=0.5) == pytest.approx(7.5)

    def test_between_one_and_two(self):
        # idx=1.5 → 5*(2-1.5) = 2.5
        assert calc_raw_comfort(avg_idx=1.5) == pytest.approx(2.5)


# ---------------------------------------------------------------------------
# Severance pay
# ---------------------------------------------------------------------------

class TestSeverance:
    def test_short_tenure(self):
        # ≤ 3 years → 1 salary
        assert calc_severance(months=24, salary=5000) == pytest.approx(5000)

    def test_long_tenure(self):
        # > 3 years → 3 salaries
        assert calc_severance(months=48, salary=5000) == pytest.approx(15000)

    def test_exactly_36_months(self):
        # exactly 36 months (3 years) → 1 salary (not > 36)
        assert calc_severance(months=36, salary=5000) == pytest.approx(5000)

    def test_37_months(self):
        # 37 months → > 36 → 3 salaries
        assert calc_severance(months=37, salary=5000) == pytest.approx(15000)

    def test_zero_tenure(self):
        assert calc_severance(months=0, salary=9000) == pytest.approx(9000)


# ---------------------------------------------------------------------------
# Agency candidate distribution
# ---------------------------------------------------------------------------

class TestEvaluationSalary:
    def test_maszynista_zero_exp(self):
        # base=9000, rate=100, exp=0 → 9000
        assert calc_evaluation_salary('maszynista', 0.0) == 9000

    def test_maszynista_with_exp(self):
        # base=9000, rate=100, exp=42.7 → 9000 + 42*100 = 13200
        assert calc_evaluation_salary('maszynista', 42.7) == 13200

    def test_konduktor(self):
        # base=5000, rate=60, exp=30 → 5000 + 30*60 = 6800
        assert calc_evaluation_salary('konduktor', 30.0) == 6800

    def test_barman(self):
        # base=4500, rate=50, exp=20 → 4500 + 20*50 = 5500
        assert calc_evaluation_salary('barman', 20.0) == 5500

    def test_floor_applied(self):
        # exp=42.9 floors to 42
        assert calc_evaluation_salary('maszynista', 42.9) == calc_evaluation_salary('maszynista', 42.0)


class TestAgencyCandidateDistribution:
    """Statistical tests on generate_candidate_exp() using a large sample."""

    N = 20_000

    @classmethod
    def setup_class(cls):
        random.seed(42)
        cls.samples = [generate_candidate_exp() for _ in range(cls.N)]

    def test_bucket_1_proportion(self):
        # 50% should fall in [10, 25]
        prop = sum(1 for e in self.samples if 10 <= e <= 25) / self.N
        assert 0.44 < prop < 0.56, f"bucket 1 proportion: {prop:.3f}"

    def test_bucket_2_proportion(self):
        # 30% should fall in (25, 40]
        prop = sum(1 for e in self.samples if 25 < e <= 40) / self.N
        assert 0.24 < prop < 0.36, f"bucket 2 proportion: {prop:.3f}"

    def test_bucket_3_proportion(self):
        # 15% should fall in (40, 55]
        prop = sum(1 for e in self.samples if 40 < e <= 55) / self.N
        assert 0.10 < prop < 0.20, f"bucket 3 proportion: {prop:.3f}"

    def test_bucket_4_proportion(self):
        # 5% should fall in (55, 75]
        prop = sum(1 for e in self.samples if 55 < e <= 75) / self.N
        assert 0.02 < prop < 0.08, f"bucket 4 proportion: {prop:.3f}"

    def test_all_values_in_range(self):
        assert all(10 <= e <= 75 for e in self.samples)
