from demand_model import calc_price


def get_public_utility(dist_km, game_config, beta_price, beta_time, beta_rep):
    """Utility of the public 'samorządowy' operator.

    All parameters come from gameConfig/params (saved via demand simulator):
      publicSpeed    — speed in km/h
      publicPrice100 — base price per 100 km (class 2)
      publicRep      — reputation (reference: 0.3)
      priceDropRate  — geometric degression per 100 km segment

    Uses the same beta coefficients as the player utility to ensure
    consistent multinomial/binary logit comparisons.
    """
    speed      = game_config.get('publicSpeed',    80)
    p100       = game_config.get('publicPrice100', 50)
    rep        = game_config.get('publicRep',       0.3)
    drop_rate  = game_config.get('priceDropRate',   0.1)

    time_min = (dist_km / speed) * 60
    price    = calc_price(dist_km, p100, drop_rate)

    return -beta_price * price - beta_time * (time_min / 60) + beta_rep * rep
