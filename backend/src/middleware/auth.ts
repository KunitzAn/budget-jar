import { FastifyRequest, FastifyReply } from 'fastify'

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const decoded = await request.jwtVerify<{ userId: number }>()
    request.userId = decoded.userId
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}