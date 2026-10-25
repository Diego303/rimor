/**
 * En las pruebas, el motor de los datos tabulares es DuckDB en Node (IN-044): solo se instancia si algo perfila o
 * consulta unos datos.
 */
import { usarMotor } from '../lectores/datos/motor';
import { crearMotorNode } from './motor-datos';

usarMotor(crearMotorNode);
