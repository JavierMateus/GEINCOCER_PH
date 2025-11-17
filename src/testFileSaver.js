import { saveAs } from 'file-saver';

const blob = new Blob(["Hola mundo"], { type: "text/plain;charset=utf-8" });
saveAs(blob, "hola.txt");