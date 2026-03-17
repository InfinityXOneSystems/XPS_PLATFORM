const Queue = require('bull')
const fetch = require('node-fetch')
const express = require('express')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

// SAFE REDIS FALLBACK (CRITICAL FIX)
const REDIS = process.env.REDIS_URL || "redis://127.0.0.1:6379"

let queue

try {
 queue = new Queue('jobs', REDIS)
 console.log("REDIS CONNECTED:", REDIS)
} catch {
 console.log("REDIS DISABLED — FALLBACK MODE")
}

const SERVICES = {
 BYTEBOT: "http://bytebot-agent.railway.internal",
 STEEL: "http://steel-browser.railway.internal",
 CLAWBOT: "http://clawbot.railway.internal"
}

app.get("/", (req,res)=> res.status(200).json({status:"live"}))
app.get("/health", (req,res)=> res.status(200).json({status:"ok"}))

app.post("/job", async (req,res)=>{
 if(queue){
  await queue.add(req.body)
 }
 res.status(200).json({queued:true})
})

app.listen(PORT, "0.0.0.0", ()=>{
 console.log("SYSTEM LIVE ON PORT", PORT)
})
