const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Staff Service Running'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Staff Service on port ${PORT}`));
