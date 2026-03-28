import math, json

lat = 52.23 * math.pi / 180
lon = 21.01
sun = {}

for d in range(1, 366):
    b = 2 * math.pi * (d - 81) / 364
    eq_time = 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)
    decl = 23.45 * math.sin(2 * math.pi * (d - 81) / 365) * math.pi / 180
    
    cos_h = -math.tan(lat) * math.tan(decl)
    cos_h = max(-1, min(1, cos_h))
    h = math.acos(cos_h) * 180 / math.pi
    
    offset = h / 15
    noon = 12 - (lon / 15) - (eq_time / 60)
    
    # Base times in UTC+1
    sunrise = noon - offset + 1
    sunset = noon + offset + 1
    
    # DST (roughly from day 89 to 301)
    if 89 <= d <= 301:
        sunrise += 1
        sunset += 1
        
    sun[str(d)] = {
        'sunrise': int(round(sunrise * 60)),
        'sunset': int(round(sunset * 60))
    }

with open('sun_times.json', 'w') as f:
    json.dump(sun, f)
