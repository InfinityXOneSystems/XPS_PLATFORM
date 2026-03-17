const Queue = require('bull')
const fetch = require('node-fetch')

const REDIS = process.env.REDIS_URL

if(!REDIS){
 console.error("NO REDIS — WORKER EXIT")
 process.exit(1)
}

const queue = new Queue('jobs', REDIS)

const SERVICES = {
 BYTEBOT: "http://bytebot-agent.railway.internal",
 STEEL: "http://steel-browser.railway.internal",
 CLAWBOT: "http://clawbot.railway.internal"
}

async function call(url, payload){
 try {
  await fetch(url,{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body: JSON.stringify(payload || {})
  })
  console.log("CALLED:", url)
 } catch(e){
  console.error("FAILED:", url)
 }
}

queue.process(async(job)=>{

 console.log("PROCESSING JOB:", job.data)

 if(job.data.type==="scrape"){
  await call(SERVICES.STEEL+"/scrape")
 }

 if(job.data.type==="agent"){
  await call(SERVICES.CLAWBOT+"/run", job.data.payload)
 }

 if(job.data.type==="automation"){
  await call(SERVICES.BYTEBOT+"/execute", job.data.payload)
 }

})

console.log("WORKER ONLINE — LISTENING FOR JOBS")
