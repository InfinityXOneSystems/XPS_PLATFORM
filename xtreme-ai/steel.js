const express = require('express')
const app = express()

app.use(express.json())

app.post('/scrape', async (req,res)=>{
 console.log("SCRAPE TRIGGERED")

 // TEMP MOCK (PROVES PIPELINE WORKS)
 res.json({
  status:"scrape-complete",
  data:[
   {name:"Test Lead 1"},
   {name:"Test Lead 2"}
  ]
 })
})

app.get('/health',(req,res)=>{
 res.json({status:"steel-browser-ok"})
})

app.listen(8080,"0.0.0.0",()=>{
 console.log("STEEL BROWSER LIVE")
})
