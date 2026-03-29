import os

def process_file(path, func):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = func(content)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. dateHelpers.js
def f(c):
    c = c.replace('export function calcAge(dob) {', 'export function calcAge(dob, referenceDate = new Date()) {')
    c = c.replace('const b = new Date(dob), now = new Date()', 'const b = new Date(dob), now = referenceDate')
    c = c.replace('export function calcTenure(hiredAt) {', 'export function calcTenure(hiredAt, referenceDate = new Date()) {')
    c = c.replace('const d = new Date(hiredAt), now = new Date()', 'const d = new Date(hiredAt), now = referenceDate')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/utils/dateHelpers.js', f)

# 2. useHRActions.js
def f2(c):
    c = c.replace('const now = new Date()', 'const now = gameDate')
    c = c.replace('const now   = new Date()', 'const now = gameDate')
    c = c.replace('new Date().toISOString()', 'gameDate.toISOString()')
    c = c.replace(': new Date()', ': gameDate')
    c = c.replace('const graduatesAt = new Date()', 'const graduatesAt = gameDate')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/context/hooks/useHRActions.js', f2)

# 3. useTrainActions.js
def f3(c):
    return c.replace('new Date().toISOString()', 'gameDate.toISOString()')
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/context/hooks/useTrainActions.js', f3)

# 4. useFinanceActions.js
def f4(c):
    c = c.replace('new Date().toISOString()', 'gameDate.toISOString()')
    c = c.replace('const createdAt = new Date()', 'const createdAt = gameDate')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/context/hooks/useFinanceActions.js', f4)

# 5. FleetCompositions.jsx
def f5(c):
    c = c.replace('const { trainsSets, trains, routes, cities, defaultPricing, updateTicketPrice, updateDefaultPricing, updateCitySchedules, employees, disbandTrainSet } = useGame()', 'const { trainsSets, trains, routes, cities, defaultPricing, updateTicketPrice, updateDefaultPricing, updateCitySchedules, employees, disbandTrainSet, gameDate } = useGame()')
    c = c.replace('now = new Date()', 'now = gameDate')
    c = c.replace('Date.now()', 'gameDate.getTime()')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/FleetCompositions.jsx', f5)

# 6. TrainTimeline.jsx
def f6(c):
    c = c.replace("export default function TrainTimeline({ rozklad }) {", "import { useGame } from '../../context/GameContext'\nexport default function TrainTimeline({ rozklad }) {\n    const { gameDate } = useGame()")
    c = c.replace('const d = new Date()', 'const d = gameDate')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/TrainTimeline.jsx', f6)

# 7. CompanyMenu.jsx
def f7(c):
    c = c.replace('const now = new Date();', 'const { gameDate: now } = useGame();')
    c = c.replace(': new Date()', ': now')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/CompanyMenu/CompanyMenu.jsx', f7)

# 8. FinanceSection.jsx
def f8(c):
    c = c.replace('const { playerDoc, deposits, depositRates, financeLedger, openCreditLine, takeLoan, repayLoan, openDeposit, closeDeposit } = useGame()', 'const { playerDoc, deposits, depositRates, financeLedger, openCreditLine, takeLoan, repayLoan, openDeposit, closeDeposit, gameDate } = useGame()')
    c = c.replace(': new Date()', ': gameDate')
    c = c.replace('new Date() -', 'gameDate -')
    c = c.replace('<= new Date()', '<= gameDate')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/CompanyMenu/sections/FinanceSection.jsx', f8)

# 9. HRSectionComponents.jsx
def f9(c):
    c = c.replace('calcAge(emp.dateOfBirth)', 'calcAge(emp.dateOfBirth, gameDate)')
    c = c.replace('calcTenure(emp.hiredAt)', 'calcTenure(emp.hiredAt, gameDate)')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/CompanyMenu/sections/HRSectionComponents.jsx', f9)

# 10. DepartureBoard.jsx
def f10(c):
    c = c.replace('const [time, setTime] = useState(new Date())', 'const { gameDate } = useGame()\n  const time = gameDate')
    
    # usuń useEffect
    lines = c.split('\n')
    new_lines = []
    skip = False
    for line in lines:
        if 'setInterval(() => setTime(new Date()), 1000)' in line:
            # cofnij się o 1 do useEffect
            new_lines.pop()
            skip = True
        elif skip and '}, [])' in line:
            skip = False
        elif not skip:
            new_lines.append(line)
    
    return '\n'.join(new_lines)
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/DepartureBoard/DepartureBoard.jsx', f10)

# 11. RouteSegmentPanel.jsx
def f11(c):
    c = c.replace('const [now, setNow] = useState(() => new Date())', 'const { gameDate: now } = useGame()')
    
    lines = c.split('\n')
    new_lines = []
    skip = False
    for line in lines:
        if 'setInterval(() => setNow(new Date()), 60000)' in line:
            new_lines.pop()
            skip = True
        elif skip and '}, [])' in line:
            skip = False
        elif not skip:
            new_lines.append(line)
            
    return '\n'.join(new_lines)
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/Sidebar/RouteSegmentPanel.jsx', f11)

# 12. TrainSetPanel.jsx
def f12(c):
    c = c.replace('const [now, setNow] = useState(() => new Date())', 'const { gameDate: now } = useGame()')
    
    lines = c.split('\n')
    new_lines = []
    skip = False
    for line in lines:
        if 'setInterval(() => setNow(new Date()), 10000)' in line:
            new_lines.pop()
            skip = True
        elif skip and '}, [])' in line:
            skip = False
        elif not skip:
            new_lines.append(line)
            
    return '\n'.join(new_lines)
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/Sidebar/TrainSetPanel.jsx', f12)

print("Refactor finished.")
