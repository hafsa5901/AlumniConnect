import { Router } from 'express';
import * as alumniController from '../controllers/alumniController';

const router = Router();

router.get('/', alumniController.listAlumni);
router.get('/:id', alumniController.getAlumniById);

export default router;
