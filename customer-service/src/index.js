const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Customer Service Running'));

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => console.log(`Customer Service on port ${PORT}`));
