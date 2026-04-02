const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Room Service Running'));

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Room Service on port ${PORT}`));
