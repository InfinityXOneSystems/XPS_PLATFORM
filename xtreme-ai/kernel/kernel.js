import Queue from 'bull'
import fetch from 'node-fetch'
import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

const queue = new Queue('jobs', process.env.REDIS_URL)

const SERVICES = {
  BYTEBOT: "http://bytebot-agent.railway.internal",
  STEEL: "http://steel-browser.railway.internal",
  CLAWBOT: "http://clawbot.railway.internal"
}

async function routeLLM(payload){

 if(payload.provider==="groq"){
  return await fetch("https://api.groq.com/openai/v1/chat/completions",{
   method:"POST",
   headers:{
    "Content-Type":"application/json",
    "Authorization":"Bearer "+process.env.GROQ_API_KEY
   },
   body:JSON.stringify(payload)
  })
 }

 if(payload.provider==="ollama"){
  return await fetch(process.env.OLLAMA_HOST+"/v1/chat/completions",{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body:JSON.stringify(payload)
  })
 }

}

queue.process(async(job)=>{

 if(job.data.type==="scrape"){
  await fetch(SERVICES.STEEL+"/scrape",{method:"POST"})
 }

 if(job.data.type==="agent"){
  await fetch(SERVICES.CLAWBOT+"/run",{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body:JSON.stringify(job.data.payload)
  })
 }

 if(job.data.type==="automation"){
  await fetch(SERVICES.BYTEBOT+"/execute",{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body:JSON.stringify(job.data.payload)
  })
 }

 if(job.data.type==="llm"){
  await routeLLM(job.data.payload)
 }

})

############################################################
# HEALTH + CONTROL ENDPOINTS
############################################################

app.get("/", (req,res)=> res.json({status:"xtreme-ai live"}))

app.get("/health", (req,res)=> res.json({status:"ok"}))

app.post("/job", async (req,res)=>{
 await queue.add(req.body)
 res.json({queued:true})
})

############################################################
# START SERVER (CRITICAL)
############################################################

app.listen(PORT, "0.0.0.0", ()=>{
 console.log("SYSTEM LIVE ON PORT", PORT)
})
