import express from 'express';
import root from "./src/routes/root.js"

const app = express()

app.use("/", root)

app.listen(3000, () => {
    console.log("Server listening on port 3000")
})