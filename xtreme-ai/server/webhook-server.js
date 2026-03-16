import express from "express"

const app = express()

app.use(express.json())

app.post("/github/webhook", async (req,res)=>{

  const event = req.headers["x-github-event"]

  console.log("===================================")
  console.log("GitHub Webhook Event:", event)
  console.log("Repository:", req.body.repository?.full_name)
  console.log("===================================")

  try{

    if(event==="push"){
      console.log("Push detected")
    }

    if(event==="pull_request"){
      console.log("Pull request event")
    }

    if(event==="workflow_run"){
      console.log("Workflow completed")
    }

    if(event==="check_suite"){
      console.log("CI check suite event")
    }

    res.status(200).json({received:true})

  }catch(err){

    console.error("Webhook error:",err)
    res.status(500).json({error:"webhook failed"})

  }

})

app.get("/",(req,res)=>{
  res.json({status:"xtreme-ai webhook server running"})
})

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
  console.log("Webhook server running on port",PORT)
})
