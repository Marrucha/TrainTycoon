import os

def patch_compositions():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/FleetCompositions.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    # 1. Remove the whole abbreviated crew row
    abbrev_start = """                                            {/* Linia obsady */}
                                            <div className={styles.crewRow}>"""
    abbrev_end = """                                            </div>
                                            {/* Linia statystyk */}"""
    
    # We will replace everything between them, including themselves, with CrewSection + LineStats
    start_idx = c.find(abbrev_start)
    end_idx = c.find(abbrev_end) + len(abbrev_end)
    
    if start_idx != -1 and end_idx != -1:
        new_hr = """                                            {/* Pełny widok Kadr wpięty od razu */}
                                            <div style={{ marginBottom: 15, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(42,74,42,0.2)' }}>
                                                <CrewSection ts={trainSet} />
                                            </div>
                                            
                                            {/* Linia statystyk */}"""
        c = c[:start_idx] + new_hr + c[end_idx-len("                                            {/* Linia statystyk */}")]

    # 2. Remove the "Kadry" toggle button
    kadry_btn = """                                                <button
                                                    className={styles.pricingBtn}
                                                    onClick={() => setCrewOpenFor(crewOpenFor === trainSet.id ? null : trainSet.id)}
                                                >
                                                    {crewOpenFor === trainSet.id ? '▲ Kadry' : '▼ Kadry'}
                                                </button>"""
    c = c.replace(kadry_btn, '')

    # 3. Remove the expanded panel at the bottom
    expanded_panel = """                                    {!isCollapsed && crewOpenFor === trainSet.id && (
                                        <div className={styles.crewPanel}>
                                            <CrewSection ts={trainSet} />
                                        </div>
                                    )}"""
    c = c.replace(expanded_panel, '')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

patch_compositions()
print("Flota patched for full crew section!")
