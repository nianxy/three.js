import { BackSide, FrontSide, CubeUVReflectionMapping, LinearEncoding, RGBEEncoding, sRGBEncoding, RGBAFormat, UnsignedByteType } from '../../constants.js';
import { BoxGeometry } from '../../geometries/BoxGeometry.js';
import { PlaneGeometry } from '../../geometries/PlaneGeometry.js';
import { ShaderMaterial } from '../../materials/ShaderMaterial.js';
import { Color } from '../../math/Color.js';
import { Mesh } from '../../objects/Mesh.js';
import { ShaderLib } from '../shaders/ShaderLib.js';
import { cloneUniforms } from '../shaders/UniformsUtils.js';

function WebGLBackground( renderer, cubemaps, state, objects, premultipliedAlpha ) {

	const clearColor = new Color( 0x000000 );
	let clearAlpha = 0;

	let planeMesh;
	let boxMesh;

	let currentBackground = null;
	let currentBackgroundVersion = 0;
	let currentTonemapping = null;
	let currentBgToneMapped = null;

	function render( renderList, scene, renderTarget ) {

		function getTextureEncodingFromMap( renderer, map ) {

			let encoding;

			if ( map && map.isTexture ) {

				encoding = map.encoding;

			} else if ( map && map.isWebGLRenderTarget ) {

				console.warn( 'THREE.WebGLPrograms.getTextureEncodingFromMap: don\'t use render targets as textures. Use their .texture property instead.' );
				encoding = map.texture.encoding;

			} else {

				encoding = LinearEncoding;

			}

			if ( renderer.capabilities.isWebGL2 && map && map.isTexture && map.format === RGBAFormat && map.type === UnsignedByteType && map.encoding === sRGBEncoding ) {

				encoding = LinearEncoding; // disable inline decode for sRGB textures in WebGL 2

			}

			return encoding;

		}

		let forceClear = false;
		let background = scene.isScene === true ? scene.background : null;
		const bgToneMapped = scene.isScene === true ? scene.bgToneMapped : false;

		if ( background && background.isTexture ) {

			background = cubemaps.get( background );

		}

		// Ignore background in AR
		// TODO: Reconsider this.

		const xr = renderer.xr;
		const session = xr.getSession && xr.getSession();

		if ( session && session.environmentBlendMode === 'additive' ) {

			background = null;

		}

		const color = clearColor.clone();
		let alpha = clearAlpha;
		if ( background && background.isColor ) {

			color.set( background );
			alpha = 1.0;
			forceClear = true;

		}

		if ( background === null || background.isColor ) {

			const outputEncoding = ( renderTarget !== null ) ? getTextureEncodingFromMap( renderer, renderTarget.texture ) : renderer.outputEncoding;

			// Assume background color is in sRGB color space.
			if ( outputEncoding === LinearEncoding ) {

				color.convertSRGBToLinear();

			} else if ( outputEncoding === RGBEEncoding ) {

				color.convertSRGBToLinear();
				alpha = 128.0 / 255.0; // Exponent will be 0.

			}

			setClear( color, alpha );

		}

		if ( renderer.autoClear || forceClear ) {

			renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );

		}

		if ( background && ( background.isCubeTexture || background.mapping === CubeUVReflectionMapping ) ) {

			if ( boxMesh === undefined ) {

				boxMesh = new Mesh(
					new BoxGeometry( 1, 1, 1 ),
					new ShaderMaterial( {
						name: 'BackgroundCubeMaterial',
						uniforms: cloneUniforms( ShaderLib.cube.uniforms ),
						vertexShader: ShaderLib.cube.vertexShader,
						fragmentShader: ShaderLib.cube.fragmentShader,
						side: BackSide,
						depthTest: false,
						depthWrite: false,
						fog: false
					} )
				);

				boxMesh.geometry.deleteAttribute( 'normal' );
				boxMesh.geometry.deleteAttribute( 'uv' );

				boxMesh.onBeforeRender = function ( renderer, scene, camera ) {

					this.matrixWorld.copyPosition( camera.matrixWorld );

				};

				// enable code injection for non-built-in material
				Object.defineProperty( boxMesh.material, 'envMap', {

					get: function () {

						return this.uniforms.envMap.value;

					}

				} );

				objects.update( boxMesh );

			}

			boxMesh.material.toneMapped = bgToneMapped;
			boxMesh.material.uniforms.envMap.value = background;
			boxMesh.material.uniforms.flipEnvMap.value = ( background.isCubeTexture && background.isRenderTargetTexture === false ) ? - 1 : 1;

			if ( currentBackground !== background ||
				currentBackgroundVersion !== background.version ||
				currentTonemapping !== renderer.toneMapping ||
				currentBgToneMapped !== bgToneMapped ) {

				boxMesh.material.needsUpdate = true;

				currentBackground = background;
				currentBackgroundVersion = background.version;
				currentTonemapping = renderer.toneMapping;
				currentBgToneMapped = bgToneMapped;

			}

			// push to the pre-sorted opaque render list
			renderList.unshift( boxMesh, boxMesh.geometry, boxMesh.material, 0, 0, null );

		} else if ( background && background.isTexture ) {

			if ( planeMesh === undefined ) {

				planeMesh = new Mesh(
					new PlaneGeometry( 2, 2 ),
					new ShaderMaterial( {
						name: 'BackgroundMaterial',
						uniforms: cloneUniforms( ShaderLib.background.uniforms ),
						vertexShader: ShaderLib.background.vertexShader,
						fragmentShader: ShaderLib.background.fragmentShader,
						side: FrontSide,
						depthTest: false,
						depthWrite: false,
						fog: false
					} )
				);

				planeMesh.geometry.deleteAttribute( 'normal' );

				// enable code injection for non-built-in material
				Object.defineProperty( planeMesh.material, 'map', {

					get: function () {

						return this.uniforms.t2D.value;

					}

				} );

				objects.update( planeMesh );

			}

			planeMesh.material.toneMapped = bgToneMapped;
			planeMesh.material.uniforms.t2D.value = background;

			if ( background.matrixAutoUpdate === true ) {

				background.updateMatrix();

			}

			planeMesh.material.uniforms.uvTransform.value.copy( background.matrix );

			if ( currentBackground !== background ||
				currentBackgroundVersion !== background.version ||
				currentTonemapping !== renderer.toneMapping ||
				currentBgToneMapped !== bgToneMapped ) {

				planeMesh.material.needsUpdate = true;

				currentBackground = background;
				currentBackgroundVersion = background.version;
				currentTonemapping = renderer.toneMapping;
				currentBgToneMapped = bgToneMapped;

			}


			// push to the pre-sorted opaque render list
			renderList.unshift( planeMesh, planeMesh.geometry, planeMesh.material, 0, 0, null );

		}

	}

	function setClear( color, alpha ) {

		state.buffers.color.setClear( color.r, color.g, color.b, alpha, premultipliedAlpha );

	}

	return {

		getClearColor: function () {

			return clearColor;

		},
		setClearColor: function ( color, alpha = 1 ) {

			clearColor.set( color );
			clearAlpha = alpha;
			setClear( clearColor, clearAlpha );

		},
		getClearAlpha: function () {

			return clearAlpha;

		},
		setClearAlpha: function ( alpha ) {

			clearAlpha = alpha;
			setClear( clearColor, clearAlpha );

		},
		render: render

	};

}


export { WebGLBackground };
