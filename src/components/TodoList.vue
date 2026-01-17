<template>
  <div class="todo-container">
    <h2>Vue Todo List</h2>
    <form @submit.prevent="addTodo">
      <input v-model="newTodo" placeholder="Add a todo..." />
      <button type="submit">Add</button>
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
import { ref } from 'vue';

const newTodo = ref('');
const todos = ref([
  { text: 'Learn Astro', done: false },
  { text: 'Try Vue in Astro', done: false },
]);

function addTodo() {
  if (newTodo.value.trim()) {
    todos.value.push({ text: newTodo.value, done: false });
    newTodo.value = '';
  }
}

function toggleTodo(idx) {
  todos.value[idx].done = !todos.value[idx].done;
}

function removeTodo(idx) {
  todos.value.splice(idx, 1);
}
</script>

<style scoped>
.todo-container {
  background: #f8f8f8;
  padding: 1rem;
  border-radius: 8px;
  max-width: 400px;
  margin: 1rem 0;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}
li span {
  flex: 1;
  cursor: pointer;
}
li span.done {
  text-decoration: line-through;
  color: #888;
}
button {
  margin-left: 0.5rem;
}
</style>
