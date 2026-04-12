const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In-memory data store
let items = [
  { id: 1, name: 'Item One', description: 'A sample item' },
  { id: 2, name: 'Item Two', description: 'Another sample item' },
];

// GET all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// GET single item
app.get('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST new item
app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const newItem = {
    id: items.length + 1,
    name,
    description: description || '',
  };
  items.push(newItem);
  res.status(201).json(newItem);
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description !== undefined) item.description = description;
  res.json(item);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex((i) => i.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const deleted = items.splice(index, 1);
  res.json({ message: 'Item deleted', item: deleted[0] });
});

let server;
function getServer() {
  if (!server) {
    server = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  }
  return server;
}

if (require.main === module) {
  getServer();
}

module.exports = app;
module.exports.getServer = getServer;
