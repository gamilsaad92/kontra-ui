import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import convertVideoRouter from "./convert-video";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(convertVideoRouter);

export default router;
