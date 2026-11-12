import json, base64, os, subprocess
SP='/tmp/claude-0/-home-user-Ecosophia/04927953-d738-5f18-b2d0-d2da830e008f/scratchpad/'
R='/home/user/Ecosophia/'
s=open(SP+'li-template.html').read()
s=s.replace('<span style="color:var(--muted)">💬 <span data-tick="76">0</span></span>','<span style="color:var(--muted)">replies <span data-tick="76">0</span></span>')
job=json.load(open(R+'design/gemini-jobs/linkedin-voice.json'))
dur=json.load(open(R+'design/film/linkedin-audio/durations.json'))['en']
scenes=[0,1,2,3,4,5,6,7,8,8,9,10]
voice={'scenes':scenes,'lines':job['lines']['en'],'dur':dur}
audio=[]
for i in range(len(job['lines']['en'])):
    f=R+f'design/film/linkedin-audio/en-{i+1:02d}.mp3'
    audio.append('data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode() if os.path.exists(f) else None)
d=json.load(open(SP+'li-data.json'))
pos=d['nuclear']['pos']
weighted=[]
for p in pos: weighted += [p]*max(1,p['n'])
agents=[weighted[(i*len(weighted))//30] for i in range(30)]
palette=list(dict.fromkeys(p['color'] for p in pos))
legend=[p for p in pos if p['b'] in ('counterpoint','market','conservative','ecosocialism','technocritique','ecofeminism')]
legend.sort(key=lambda p:-p['score'])
names={'counterpoint':'Ecomodernists','market':'Liberals','conservative':'Conservatives','ecosocialism':'Ecosocialists','technocritique':'Technocritics','ecofeminism':'Ecofeminists'}
data={'palette':palette,'nuclear':[{'b':a['b'],'score':a['score'],'color':a['color']} for a in agents],'legend':[{'name':names[p['b']],'score':p['score'],'color':p['color']} for p in legend]}
s=s.replace('__VOICE__',json.dumps(voice)).replace('__AUDIO__',json.dumps(audio)).replace('__DATA__',json.dumps(data))
s=s.replace('__COST__',d['avgCost'][:4].rstrip('0').rstrip('.') if False else '2.30').replace('__RUNS__',str(d['runs']))
art=json.load(open(SP+'li-art.json')) if os.path.exists(SP+'li-art.json') else {}
for k in range(1,7): s=s.replace(f'__ART{k}__',art.get(str(k),''))
assert '__' not in s
open(SP+'mirofish-linkedin.html','w').write(s)
print(len(s)//1024,'KB')
