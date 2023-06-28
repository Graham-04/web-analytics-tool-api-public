import * as dotenv from "dotenv";
import jwt from 'jsonwebtoken';

dotenv.config();

class JWT {
  generateToken(email: string, user_id: string): Promise<string> {
    return new Promise((resolve, reject) => {
          jwt.sign({user_id: user_id}, process.env.JWT_SECRET as string, {expiresIn: '1hr'}, (err: Error | null, token?: string) => {
            if (err) {
              reject(err);
            } else {
              console.log(token);
              resolve(token as string);
            }
          });
        }
    )
  };

}

export default new JWT();
