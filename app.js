const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
app.use(express.json());

const jwt = require("jsonwebtoken");

let db = null;

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Is Running On 3000 Port");
    });
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
    process.exit(1);
  }
};

initializeDbServer();

//To Login User

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const toGetUserDetails = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(toGetUserDetails);
  if (userDetails !== undefined) {
    const isPasswordSameCheck = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordSameCheck) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MyNameIsSaiKrishna");
      console.log(jwtToken);
      response.status(200);
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//MiddleWare For Authenticating JWT Token

const authenticateToken = async (request, response, next) => {
  const tokenCheck = request.headers.authorization;
  if (tokenCheck === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const jwtToken = tokenCheck.split(" ")[1];
    await jwt.verify(jwtToken, "MyNameIsSaiKrishna", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//To Get States Details

app.get("/states/", authenticateToken, async (request, response) => {
  const toGetAllStatesQuery = `SELECT 
  state_id AS stateId,state_name AS stateName
  ,population FROM state;`;
  const result = await db.all(toGetAllStatesQuery);
  response.status(200);
  response.send(result);
});

//To Get A Specific State

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const toGetASpecificStateQuery = `SELECT 
  state_id AS stateId,state_name AS stateName,population FROM state 
  WHERE state_id=${stateId};`;
  const result = await db.get(toGetASpecificStateQuery);
  response.status(200);
  response.send(result);
});

//To Add A New District

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const toAddNewDistrictQuery = `INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths) 
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(toAddNewDistrictQuery);
  response.status(200);
  response.send("District Successfully Added");
});

//To return a district based on the district ID

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const toGetSpecificDistrictQuery = `SELECT 
    district_id AS districtId,district_name AS districtName
    ,state_id AS stateId,cases,cured,active,deaths 
    FROM district WHERE district_id=${districtId};`;
    const result = await db.get(toGetSpecificDistrictQuery);
    response.status(200);
    response.send(result);
  }
);

//To Delete A District

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const toDeleteADistrict = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(toDeleteADistrict);
    response.status(200);
    response.send("District Removed");
  }
);

//To Update A District Details

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateADistrictQuery = `UPDATE district 
    SET district_name='${districtName}',state_id=${stateId}
    ,cases=${cases},cured=${cured},active=${active},deaths=${deaths} 
    WHERE district_id=${districtId};`;
    await db.run(updateADistrictQuery);
    response.status(200);
    response.send("District Details Updated");
  }
);

//To return Stats of A State

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const toGetAStateStats = `SELECT SUM(cases) AS totalCases
    ,SUM(cured) AS totalCured,SUM(active) AS totalActive
    ,SUM(deaths) AS totalDeaths 
    FROM state NATURAL JOIN district 
    WHERE state.state_id=${stateId};`;
    const [result] = await db.all(toGetAStateStats);
    response.send(result);
  }
);

module.exports = app;
