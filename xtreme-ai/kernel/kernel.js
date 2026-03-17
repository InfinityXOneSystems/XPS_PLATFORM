const Queue = require('bull')
const fetch = require('node-fetch')
const express = require('express')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

const REDIS = process.env.REDIS_URL

if(!REDIS){
 console.error("FATAL: REDIS_URL MISSING")
 process.exit(1)
}

const queue = new Queue('jobs', REDIS)

const SERVICES = {
 BYTEBOT: "http://bytebot-agent.railway.internal",
 STEEL: "http://steel-browser.railway.internal",
 CLAWBOT: "http://clawbot.railway.internal"
}

async function callService(url, payload){
 try {
  await fetch(url,{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body: JSON.stringify(payload || {})
  })
 } catch(e){
  console.error("SERVICE ERROR:", url)
 }
}

queue.process(async(job)=>{

 if(job.data.type==="scrape"){
  await callService(SERVICES.STEEL+"/scrape")
 }

 if(job.data.type==="agent"){
  await callService(SERVICES.CLAWBOT+"/run", job.data.payload)
 }

 if(job.data.type==="automation"){
  await callService(SERVICES.BYTEBOT+"/execute", job.data.payload)
 }

})

app.get("/", (req,res)=> res.json({status:"live"}))
app.get("/health", (req,res)=> res.json({status:"ok"}))

app.post("/job", async (req,res)=>{
 await queue.add(req.body)
 res.json({queued:true})
})

app.listen(PORT,"0.0.0.0",()=>{
 console.log("SYSTEM LIVE WITH REDIS + SERVICE MESH")
})
