let context:AudioContext|undefined,master:GainNode|undefined,timer:number|undefined
let note=0
function tone(frequency:number,duration:number,strength:number,type:OscillatorType='sine'){
  if(!context||!master)return
  const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime
  oscillator.type=type;oscillator.frequency.value=frequency
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(strength,now+.015)
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration)
  oscillator.connect(gain);gain.connect(master);oscillator.start();oscillator.stop(now+duration+.01)
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}
}
const notes:Record<string,number>={mote_picked:880,lantern_lit:1175,pulse:262,player_hit:98,jump:523,dash:330,won:1047,lost:131,shade_spawned:147,countdown:659,wind:220,charm_picked:988,drifter_steal:196,drifter_drop:784}
export const gameAudio={
  start(volume:number){if(!context){context=new AudioContext();master=context.createGain();master.connect(context.destination)}void context.resume();this.volume(volume)},
  volume(v:number){if(master)master.gain.value=v},
  music(on:boolean){
    window.clearInterval(timer)
    if(on){const phrase=[196,247,294,370,330,294,247,220];timer=window.setInterval(()=>tone(phrase[note++%phrase.length],.9,.065),650)}
  },
  effect(name:string){if(notes[name])tone(notes[name],name==='won'||name==='lost'?.7:.22,.19,'triangle')}
}
