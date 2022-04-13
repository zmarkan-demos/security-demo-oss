const axios = require('axios').default
const assert = require('assert')
const helloWorld = require("../app.js")
const base_url = "http://localhost:3232/"

describe("Welcome to CI/CD Server", function() {

  describe("GET /", function() {
    it("returns status code 200", function(done) {
      axios.get(base_url).then(
        (response) => {
          assert.equal(200, response.status);
          helloWorld.close();
        }
      ).then(done, done)
    })
  });
  

  describe("welcomeMessage", function (){
    it("Validate Message", function(){
      var res = helloWorld.welcomeMessage();
      var message = "Welcome to the CityJS CircleCI Demo!";
      assert.strictEqual(res, message);
    });  
  });
});
