/* eslint-disable prettier/prettier */
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create new user account' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User signup successfully' })
  @ApiResponse({ status: 400, description: 'Bad request / validation error' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user and return JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'User login successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('social-login')
  @ApiOperation({ summary: 'Login or signup user with social account' })
  @ApiBody({ type: SocialLoginDto })
  @ApiResponse({ status: 201, description: 'Social login successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async socialLogin(@Body() body: SocialLoginDto) {
    const { authProvider, name, email, socialId, displayPic, fcmToken } = body;

    return this.authService.socialLogin(
      authProvider,
      name,
      email,
      socialId,
      displayPic,
      fcmToken,
    );
  }
}