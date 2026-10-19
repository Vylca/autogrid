<script setup>
const props = defineProps({ name: String, size: { type: Number, default: 18 } });
const paths = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  grid: 'M4 4h16v16H4zM4 10h16M4 16h16M10 4v16',
  users: 'M9 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.8a3.2 3.2 0 0 1 0 6M18 14.6c2 .6 3 2.6 3 5.4',
  exam: 'M9 3h6v3H9zM8 4.5H5.5V21h13V4.5H16M8.5 13.5l2.5 2.5 4.5-4.5',
  comment: 'M4 5h16v11H9l-5 4z',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  back: 'M19 12H5M11 6l-6 6 6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18',
  print: 'M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z',
  reset: 'M4 4v6h6M5.2 15a8 8 0 1 0 1.8-8.4L4 10',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 19M8.1 16.1L20 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
};
</script>

<template>
  <svg
    class="icon"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[props.name] || ''" />
  </svg>
</template>
