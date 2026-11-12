import json, base64, os
SP='/tmp/claude-0/-home-user-Ecosophia/04927953-d738-5f18-b2d0-d2da830e008f/scratchpad/'
R='/home/user/Ecosophia/'
s=open(SP+'film-template-v2.html').read()
d=json.load(open(SP+'video-data.json'))
p=json.load(open(SP+'video-portraits.json'))
logo=open(SP+'video-logo.svg').read()
job=json.load(open(R+'design/gemini-jobs/film-voice.json'))
dur=json.load(open(R+'design/film/audio/durations.json'))
scenes=[0,0,1,1,2,2,3,4,5,6,6,7,8]
voice={'scenes':scenes,'lines':job['lines'],'dur':dur}
audio={}
for l in ['en','fr']:
    audio[l]=[]
    for i in range(len(job['lines'][l])):
        f=R+f'design/film/audio/{l}-{i+1:02d}.mp3'
        audio[l].append('data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode() if os.path.exists(f) else None)
seeds=[{"name":{"en":"Deep ecology","fr":"Écologie profonde"},"text":{"en":"Asks why a society pollutes before asking how to pollute less.","fr":"Demande pourquoi une société pollue avant de demander comment polluer moins."},"src":"The Shallow and the Deep, Long-Range Ecology Movement","y":1973},{"name":{"en":"Ecosophy T","fr":"Écosophie T"},"text":{"en":"A personal philosophy of ecological harmony. Everyone is invited to work out their own.","fr":"Une philosophie personnelle de l'harmonie écologique. Chacun est invité à élaborer la sienne."},"src":"Ecology, Community and Lifestyle","y":1989},{"name":{"en":"Self-realisation","fr":"Réalisation de soi"},"text":{"en":"The self widens to include other beings, so caring for them needs no moral command.","fr":"Le soi s'élargit jusqu'à inclure les autres êtres : en prendre soin ne requiert plus de commandement moral."},"src":"Self-Realization: An Ecological Approach to Being in the World","y":1987}]
non_graft=len([b for b in d['branches'] if not b['graft']]); grafts=len(d['branches'])-non_graft
s=s.replace('__VOICE__',json.dumps(voice,ensure_ascii=False)).replace('__AUDIO__',json.dumps(audio))
s=s.replace('__DATA__',json.dumps({k:d[k] for k in ['branches','roots','trunk','canopy','run']},ensure_ascii=False))
s=s.replace('__SEEDS__',json.dumps(seeds,ensure_ascii=False)).replace('__LOGO__',logo)
s=s.replace('__NAESS__',p['arne-naess']).replace('__SINGER__',p['peter-singer']).replace('__PLUMWOOD__',p['val-plumwood'])
s=s.replace('__AUTHORS__',str(d['authors'])).replace('__SCHOOLS__',str(non_graft)).replace('__GRAFTS__',str(grafts)).replace('__LINKS__',str(d['links'])).replace('__RUNS__',str(d['runs']))
assert '__' not in s.replace('__proto__','')
open(SP+'ecosophia-film.html','w').write(s)
print(len(s)//1024,'KB')
