import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

// server configuration
const server = express();
server.use(cors());
server.use(express.json());

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("test");
});

const userSchema = joi.object({
  name: joi.string().min(1).required(),
});

const messageSchema = joi.object({
  to: joi.string().required().min(1),
  type: joi.string().required().valid("message", "private_message").min(1),
  text: joi.string().required().min(1),
});

server.post("/participants", async (req, res) => {
  const { name } = req.body;
  try {
    const validation = userSchema.validate(req.body, {
      abortEarly: false,
    });
    if (validation.error) {
      const erros = validation.error.details.map((erro) => erro.message);
      console.log(erros);
      return res.status(422).send(erros);
    }

    const existingUser = await db
      .collection("participants")
      .findOne({ name: name });

    if (!existingUser) {
      const participant = {
        name: req.body.name,
        lastStatus: Date.now(),
      };

      const message = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      };

      db.collection("participants").insertOne(participant);
      db.collection("messages").insertOne(message);
      res.sendStatus(201);
    } else {
      res.status(409).send("Username already in use!");
    }
  } catch (err) {
    console.log(err);
  }
});

server.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
  }
});

server.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;

  try {
    if (!user) {
      return res
        .status(422)
        .send("Um usuário deve ser informado para o envio da mensagem");
    }

    const existingUser = await db
      .collection("participants")
      .findOne({ name: user });
    if (!existingUser) {
      return res.status(422).send("Usuário não existente!");
    }

    const validation = messageSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
      const erros = validation.error.details.map((erro) => erro.message);
      console.log(erros);
      return res.status(422).send(erros);
    }

    const message = {
      to: to,
      from: user,
      text: text,
      type: type,
      time: dayjs().format("HH:mm:ss"),
    };

    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
    return;
  } catch (error) {
    console.log(error);
  }
});

server.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const user = req.headers.user;

  try {
    if (!user) {
      return res
        .status(422)
        .send("Um usuário deve ser informado para obtenção das mensagens!");
    }

    const allMessages = await db.collection("messages").find().toArray();
    const userMessages = allMessages.filter(
      (message) =>
        message.to === "Todos" || message.to === user || message.from === user
    );
    return res
      .status(200)
      .send(limit ? userMessages.slice(-limit) : userMessages);
  } catch (error) {
    console.log(error);
  }
});

server.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    const existingUser = await db
      .collection("participants")
      .findOne({ name: user });
    if (!existingUser || !user) {
      return res.sendStatus(404);
    }
    const participant = {
      name: user,
      lastStatus: Date.now(),
    };

    await db.collection("participants").updateOne(
      {
        _id: existingUser._id,
      },
      { $set: participant }
    );

    res.sendStatus(200);
    return;
  } catch (error) {
    console.log(error);
  }
});

server.delete("/messages/:idMessage", async (req, res) => {
  const user = req.headers.user;
  const idMessage = req.params.idMessage;
  console.log(user, idMessage);
  // console.log(new ObjectId(idMessage));
  if (!user || !idMessage) {
    return res.sendStatus(404);
  }
  try {
    const deletingMessage = await db
      .collection("messages")
      .findOne({ _id: ObjectId(idMessage) });
    console.log(deletingMessage);
    if (!deletingMessage) {
      return res.status(404).send("Mensagem com id recebido não existe!");
    }
    if (deletingMessage.from !== user) {
      return res.status(401).send("Usuário não é o dono da mensagem!");
    }

    db.collection("messages").deleteOne(deletingMessage);
  } catch (error) {
    console.log(error);
  }
});

function validateLoggedUser() {
  setInterval(async () => {
    try {
      const nowTime = Date.now();
      const allParticipants = await db
        .collection("participants")
        .find()
        .toArray();

      for (let i = 0; i < allParticipants.length; i++) {
        if (nowTime - allParticipants[i].lastStatus > 10000) {
          const message = {
            from: allParticipants[i].name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
          };

          db.collection("participants").deleteOne({
            _id: allParticipants[i]._id,
          });
          db.collection("messages").insertOne(message);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }, 15000);
}
//
validateLoggedUser();

server.listen(5000, () => console.log("Server is listening on port 5000"));
