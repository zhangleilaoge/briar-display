<template>
  <div class="todo-container">
    <span class="todo-eyebrow">Liste</span>
    <h2>Vue Todo List</h2>
    <form @submit.prevent="addTodo">
      <input v-model="newTodo" placeholder="Add a todo..." />
      <button type="submit" class="primary">Add</button>
    </form>
    <ul>
      <li v-for="(todo, idx) in todos" :key="idx">
        <span :class="{ done: todo.done }" @click="toggleTodo(idx)">{{ todo.text }}</span>
        <button @click="removeTodo(idx)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const newTodo = ref('')
const todos = ref([
	{ text: 'Learn Astro', done: false },
	{ text: 'Try Vue in Astro', done: false },
])

function addTodo() {
	if (newTodo.value.trim()) {
		todos.value.push({ text: newTodo.value, done: false })
		newTodo.value = ''
	}
}

function toggleTodo(idx) {
	todos.value[idx].done = !todos.value[idx].done
}

function removeTodo(idx) {
	todos.value.splice(idx, 1)
}
</script>

<style scoped>
/* 只消费 Reverie 主题 token（src/styles/theme.css） */
.todo-container {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border) / 0.8);
  box-shadow: var(--shadow-surface);
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-surface);
  max-width: 420px;
  margin: 1rem 0;
}
.todo-eyebrow {
  font-family: var(--font-label);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
h2 {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0.25rem 0 0.75rem;
}
form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
input {
  flex: 1;
  height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius-field);
  background: hsl(var(--card) / 0.8);
  color: inherit;
  font: inherit;
  outline: none;
}
input:focus {
  box-shadow: var(--glow-focus);
}
button {
  height: 2.25rem;
  padding: 0 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-control);
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font-family: var(--font-control);
  letter-spacing: var(--control-tracking);
  box-shadow: var(--shadow-control);
  cursor: pointer;
}
button:hover {
  box-shadow: var(--shadow-control-hover);
}
button.primary {
  border-color: transparent;
  background-color: hsl(var(--primary));
  background-image: var(--btn-primary-image);
  color: hsl(var(--btn-primary-fg));
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-top: 1px solid hsl(var(--border) / 0.6);
}
li span {
  flex: 1;
  cursor: pointer;
}
li span.done {
  text-decoration: line-through;
  color: hsl(var(--muted-foreground));
}
</style>
