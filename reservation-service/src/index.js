const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Reservation Service Running'));

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Reservation Service on port ${PORT}`));
