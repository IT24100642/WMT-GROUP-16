const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Review Service Running'));

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => console.log(`Review Service on port ${PORT}`));
