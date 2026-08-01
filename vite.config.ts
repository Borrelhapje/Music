export default {
    server : {
        host: "0.0.0.0",
        allowedHosts: ["vscode.helderman.xyz"],
        proxy: {
            "/list": "http://localhost:8081",
            "/complete": "http://localhost:8081"
        }
    },

};
