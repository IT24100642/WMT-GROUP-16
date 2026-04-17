const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Restaurant Service Running'));

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => console.log(`Restaurant Service on port ${PORT}`));
