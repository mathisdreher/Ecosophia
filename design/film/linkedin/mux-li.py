import json, subprocess
SP='/tmp/claude-0/-home-user-Ecosophia/04927953-d738-5f18-b2d0-d2da830e008f/scratchpad/'
R='/home/user/Ecosophia/design/film/linkedin-audio/'
tm=json.load(open(SP+'rec/timing.json'))
end=tm['end']; starts=tm['starts']; off=tm['offset']
cmd=['ffmpeg','-y','-loglevel','error','-ss',f'{off:.3f}','-i',SP+'rec/'+tm['video']]
for i in range(len(starts)): cmd+=['-i',R+f'en-{i+1:02d}.mp3']
f=[]
for i,s in enumerate(starts):
    ms=int(s*1000); f.append(f'[{i+1}:a]adelay={ms}|{ms},volume=1.15[a{i}]')
f.append(f'sine=f=98:d={end:.2f},volume=0.030[s1]')
f.append(f'sine=f=146.83:d={end:.2f},volume=0.016[s2]')
f.append(f'sine=f=196:d={end:.2f},volume=0.010[s3]')
f.append(f'[s1][s2][s3]amix=inputs=3:normalize=0,lowpass=f=600,tremolo=f=0.15:d=0.25,afade=t=in:d=3,afade=t=out:st={end-3:.2f}:d=3[pad]')
f.append(''.join(f'[a{i}]' for i in range(len(starts)))+f'[pad]amix=inputs={len(starts)+1}:normalize=0,alimiter=limit=0.9[aout]')
cmd+=['-filter_complex',';'.join(f),'-map','0:v','-map','[aout]','-t',f'{end:.2f}','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',SP+'mirofish-linkedin.mp4']
subprocess.run(cmd,check=True)
print(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=width,height,codec_name','-of','compact',SP+'mirofish-linkedin.mp4'],capture_output=True,text=True).stdout)
